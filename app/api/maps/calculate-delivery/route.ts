import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CalculateDeliveryPayload = {
  business_id?: string;
  customer_address?: string;
};

type OpenRouteServiceFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    label?: string;
    name?: string;
    country?: string;
    region?: string;
    locality?: string;
  };
};

type OpenRouteServiceGeocodeResponse = {
  features?: OpenRouteServiceFeature[];
};

type OpenRouteServiceRouteResponse = {
  routes?: Array<{
    summary?: {
      distance?: number;
      duration?: number;
    };
  }>;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

async function requireBusinessUser(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  const token = getBearerToken(request);

  if (!token) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, business_id, school_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabaseAdmin,
      user,
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
    };
  }

  const isSuperAdmin = profile.role === "super_admin";
  const isBusinessUser =
    profile.role === "business_owner" || profile.role === "staff";

  if (!isSuperAdmin && !isBusinessUser) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only business users can calculate delivery." },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    user,
    profile,
    error: null,
  };
}

async function geocodeAddress(address: string) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTESERVICE_API_KEY environment variable.");
  }

  const url = new URL("https://api.openrouteservice.org/geocode/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", address);
  url.searchParams.set("size", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json()) as OpenRouteServiceGeocodeResponse;

  if (!response.ok) {
    throw new Error("Failed to geocode customer address.");
  }

  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    throw new Error("Could not find coordinates for this address.");
  }

  const [longitude, latitude] = coordinates;

  return {
    latitude,
    longitude,
    label: feature.properties?.label || address,
  };
}

async function calculateRoute({
  fromLatitude,
  fromLongitude,
  toLatitude,
  toLongitude,
}: {
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
}) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTESERVICE_API_KEY environment variable.");
  }

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [fromLongitude, fromLatitude],
          [toLongitude, toLatitude],
        ],
      }),
    }
  );

  const data = (await response.json()) as OpenRouteServiceRouteResponse;

  if (!response.ok) {
    throw new Error("Failed to calculate delivery route.");
  }

  const summary = data.routes?.[0]?.summary;

  if (!summary || typeof summary.distance !== "number") {
    throw new Error("Could not calculate route distance.");
  }

  const distanceKm = summary.distance / 1000;
  const durationMinutes = (summary.duration || 0) / 60;

  return {
    distance_km: Number(distanceKm.toFixed(2)),
    duration_minutes: Math.ceil(durationMinutes),
  };
}

function calculateDeliveryFee({
  distanceKm,
  baseFee,
  feePerKm,
  freeRadiusKm,
  minimumFee,
}: {
  distanceKm: number;
  baseFee: number;
  feePerKm: number;
  freeRadiusKm: number;
  minimumFee: number;
}) {
  const billableKm = Math.max(distanceKm - freeRadiusKm, 0);
  const calculatedFee = baseFee + billableKm * feePerKm;
  const finalFee = Math.max(calculatedFee, minimumFee);

  return {
    billable_km: Number(billableKm.toFixed(2)),
    calculated_delivery_fee: Number(calculatedFee.toFixed(2)),
    minimum_delivery_fee: Number(minimumFee.toFixed(2)),
    delivery_fee: Number(finalFee.toFixed(2)),
  };
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
    }

    const body = (await request.json()) as CalculateDeliveryPayload;

    const customerAddress = cleanText(body.customer_address);

    if (!customerAddress) {
      return NextResponse.json(
        { error: "Customer delivery address is required." },
        { status: 400 }
      );
    }

    let businessId = cleanText(body.business_id);

    if (profile.role !== "super_admin") {
      businessId = profile.business_id || "";
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 400 }
      );
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        `
        id,
        name,
        location,
        latitude,
        longitude,
        delivery_base_fee,
        delivery_fee_per_km,
        delivery_free_radius_km,
        delivery_minimum_fee,
        delivery_max_radius_km
      `
      )
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const businessLatitude = toNumber(business.latitude, NaN);
    const businessLongitude = toNumber(business.longitude, NaN);

    if (
      !Number.isFinite(businessLatitude) ||
      !Number.isFinite(businessLongitude)
    ) {
      return NextResponse.json(
        {
          error:
            "Business location coordinates are missing. Add latitude and longitude to the business profile first.",
        },
        { status: 400 }
      );
    }

    const customerLocation = await geocodeAddress(customerAddress);

    const route = await calculateRoute({
      fromLatitude: businessLatitude,
      fromLongitude: businessLongitude,
      toLatitude: customerLocation.latitude,
      toLongitude: customerLocation.longitude,
    });

    const maxRadiusKm =
      business.delivery_max_radius_km === null ||
      business.delivery_max_radius_km === undefined
        ? null
        : toNumber(business.delivery_max_radius_km, 0);

    const isOutsideDeliveryRadius =
      maxRadiusKm !== null && maxRadiusKm > 0 && route.distance_km > maxRadiusKm;

    const feeResult = calculateDeliveryFee({
      distanceKm: route.distance_km,
      baseFee: toNumber(business.delivery_base_fee, 0),
      feePerKm: toNumber(business.delivery_fee_per_km, 0),
      freeRadiusKm: toNumber(business.delivery_free_radius_km, 0),
      minimumFee: toNumber(business.delivery_minimum_fee, 0),
    });

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        location: business.location,
        latitude: businessLatitude,
        longitude: businessLongitude,
      },
      customer_location: customerLocation,
      route,
      pricing: {
        currency: "NGN",
        base_fee: toNumber(business.delivery_base_fee, 0),
        fee_per_km: toNumber(business.delivery_fee_per_km, 0),
        free_radius_km: toNumber(business.delivery_free_radius_km, 0),
        minimum_delivery_fee: feeResult.minimum_delivery_fee,
        max_radius_km: maxRadiusKm,
        billable_km: feeResult.billable_km,
        calculated_delivery_fee: feeResult.calculated_delivery_fee,
        delivery_fee: feeResult.delivery_fee,
        is_outside_delivery_radius: isOutsideDeliveryRadius,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate delivery.",
      },
      { status: 500 }
    );
  }
}