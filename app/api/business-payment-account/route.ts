import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type PaymentAccountPayload = {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  payment_note?: string | null;
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

function cleanAccountNumber(value: unknown) {
  const text = cleanText(value);
  return text.replace(/[^\d]/g, "");
}

async function requireBusinessOwner(request: Request) {
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

  if (profile.role !== "business_owner") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only business owners can manage payment details." },
        { status: 403 }
      ),
    };
  }

  if (!profile.business_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This account is not assigned to a business." },
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

  if (profile.role !== "business_owner" && profile.role !== "staff") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only business users can view payment details." },
        { status: 403 }
      ),
    };
  }

  if (!profile.business_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This account is not assigned to a business." },
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

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const { data: paymentAccount, error: paymentError } = await supabaseAdmin
      .from("business_payment_accounts")
      .select(
        `
        id,
        business_id,
        bank_name,
        account_name,
        account_number,
        payment_note,
        is_default,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("business_id", profile.business_id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payment_account: paymentAccount || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load payment account.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessOwner(
      request
    );

    if (error || !profile) return error;

    const body = (await request.json()) as PaymentAccountPayload;

    const bankName = cleanText(body.bank_name);
    const accountName = cleanText(body.account_name);
    const accountNumber = cleanAccountNumber(body.account_number);
    const paymentNote =
      cleanText(body.payment_note) ||
      "After payment, please send proof of payment here.";

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required." },
        { status: 400 }
      );
    }

    if (!accountName) {
      return NextResponse.json(
        { error: "Account name is required." },
        { status: 400 }
      );
    }

    if (!accountNumber) {
      return NextResponse.json(
        { error: "Account number is required." },
        { status: 400 }
      );
    }

    if (accountNumber.length < 8 || accountNumber.length > 20) {
      return NextResponse.json(
        { error: "Account number must be between 8 and 20 digits." },
        { status: 400 }
      );
    }

    const { data: existingAccount } = await supabaseAdmin
      .from("business_payment_accounts")
      .select("id")
      .eq("business_id", profile.business_id)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (existingAccount?.id) {
      const { data: updatedAccount, error: updateError } = await supabaseAdmin
        .from("business_payment_accounts")
        .update({
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          payment_note: paymentNote,
          is_default: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAccount.id)
        .eq("business_id", profile.business_id)
        .select(
          `
          id,
          business_id,
          bank_name,
          account_name,
          account_number,
          payment_note,
          is_default,
          is_active,
          created_at,
          updated_at
        `
        )
        .single();

      if (updateError || !updatedAccount) {
        return NextResponse.json(
          { error: updateError?.message || "Failed to update payment account." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        payment_account: updatedAccount,
        message: "Payment account updated.",
      });
    }

    const { data: newAccount, error: insertError } = await supabaseAdmin
      .from("business_payment_accounts")
      .insert({
        business_id: profile.business_id,
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        payment_note: paymentNote,
        is_default: true,
        is_active: true,
      })
      .select(
        `
        id,
        business_id,
        bank_name,
        account_name,
        account_number,
        payment_note,
        is_default,
        is_active,
        created_at,
        updated_at
      `
      )
      .single();

    if (insertError || !newAccount) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create payment account." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payment_account: newAccount,
      message: "Payment account saved.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save payment account.",
      },
      { status: 500 }
    );
  }
}