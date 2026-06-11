import { runSalesAgentCore } from "@/lib/salesAgentCore";

type Row = Record<string, any>;

class FakeQuery {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private insertPayload: any = null;
  private updatePayload: any = null;
  private filters: Array<{ column: string; value: any }> = [];
  private inFilters: Array<{ column: string; values: any[] }> = [];
  private orderRule: { column: string; ascending: boolean } | null = null;
  private limitValue: number | null = null;

  constructor(
    private db: Record<string, Row[]>,
    private table: string,
  ) {}

  select(_columns = "*") {
    return this;
  }

  insert(payload: any) {
    this.action = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: any) {
    this.action = "update";
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column: `!${column}`, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderRule = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  async single() {
    const result = await this.execute();
    return {
      data: Array.isArray(result.data) ? result.data[0] || null : result.data,
      error: result.error,
    };
  }

  async maybeSingle() {
    const result = await this.execute();
    return {
      data: Array.isArray(result.data) ? result.data[0] || null : result.data,
      error: result.error,
    };
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  private get rows() {
    if (!this.db[this.table]) this.db[this.table] = [];
    return this.db[this.table];
  }

  private matches(row: Row) {
    for (const filter of this.filters) {
      if (filter.column.startsWith("!")) {
        const column = filter.column.slice(1);
        if (row[column] === filter.value) return false;
      } else if (row[filter.column] !== filter.value) {
        return false;
      }
    }

    for (const filter of this.inFilters) {
      if (!filter.values.includes(row[filter.column])) return false;
    }

    return true;
  }

  private applyQuery(rows: Row[]) {
    let result = rows.filter((row) => this.matches(row));

    if (this.orderRule) {
      const { column, ascending } = this.orderRule;

      result = [...result].sort((a, b) => {
        const left = String(a[column] || "");
        const right = String(b[column] || "");

        return ascending
          ? left.localeCompare(right)
          : right.localeCompare(left);
      });
    }

    if (this.limitValue !== null) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }

  private async execute() {
    try {
      const now = new Date().toISOString();

      if (this.action === "insert") {
        const payloads = Array.isArray(this.insertPayload)
          ? this.insertPayload
          : [this.insertPayload];

        const inserted = payloads.map((payload) => ({
          id: payload.id || crypto.randomUUID(),
          created_at: payload.created_at || now,
          updated_at: payload.updated_at || now,
          ...payload,
        }));

        this.rows.push(...inserted);

        return {
          data: Array.isArray(this.insertPayload) ? inserted : inserted[0],
          error: null,
        };
      }

      if (this.action === "update") {
        const updated: Row[] = [];

        for (const row of this.rows) {
          if (!this.matches(row)) continue;

          Object.assign(row, {
            ...this.updatePayload,
            updated_at: this.updatePayload.updated_at || now,
          });

          updated.push(row);
        }

        return {
          data: updated,
          error: null,
        };
      }

      if (this.action === "delete") {
        const before = this.rows.length;
        this.db[this.table] = this.rows.filter((row) => !this.matches(row));

        return {
          data: [],
          error: null,
          count: before - this.db[this.table].length,
        };
      }

      return {
        data: this.applyQuery(this.rows),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error,
      };
    }
  }
}

class FakeSupabaseAdmin {
  public db: Record<string, Row[]> = {
    conversation_order_states: [],
    conversation_order_items: [],
  };

  from(table: string) {
    return new FakeQuery(this.db, table);
  }
}

const businessKnowledge = `
Business Overview:
ZCAS is a pastry and snacks business.

Products and Prices:
Meat Pie - N1500
Samosa - N350
Spring Roll - N350
Egg Roll - N1000
Doughnut - N800
Fruit Juice - N2000
Cakes - available on request
`;

const recentMessages: Array<{
  sender_type: string;
  content: string;
  created_at: string;
}> = [];

function assertContains(reply: string | null, expected: string, label: string) {
  if (!reply || !reply.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(
      `${label} failed.\nExpected reply to contain: ${expected}\nActual reply: ${reply}`,
    );
  }
}

function assertNotContains(reply: string | null, blocked: string, label: string) {
  if (reply && reply.toLowerCase().includes(blocked.toLowerCase())) {
    throw new Error(
      `${label} failed.\nReply should not contain: ${blocked}\nActual reply: ${reply}`,
    );
  }
}

async function sendMessage({
  supabaseAdmin,
  message,
  label,
  shouldContain,
  shouldNotContain,
}: {
  supabaseAdmin: FakeSupabaseAdmin;
  message: string;
  label: string;
  shouldContain?: string[];
  shouldNotContain?: string[];
}) {
  const result = await runSalesAgentCore({
    supabaseAdmin,
    businessId: "test-business",
    customerId: "test-customer",
    conversationId: "test-conversation",
    customerName: "Hex",
    customerMessage: message,
    businessKnowledge,
    recentMessages,
  });

  console.log("\n---");
  console.log(label);
  console.log("Customer:", message);
  console.log("Handled:", result.handled);
  console.log("Intent:", result.intent);
  console.log("Stage:", result.stage);
  console.log("Reply:", result.directReply);

  if (!result.handled) {
    throw new Error(`${label} failed. Sales Agent Core did not handle this message.`);
  }

  for (const expected of shouldContain || []) {
    assertContains(result.directReply, expected, label);
  }

  for (const blocked of shouldNotContain || []) {
    assertNotContains(result.directReply, blocked, label);
  }

  recentMessages.push({
    sender_type: "customer",
    content: message,
    created_at: new Date().toISOString(),
  });

  if (result.directReply) {
    recentMessages.push({
      sender_type: "ai",
      content: result.directReply,
      created_at: new Date().toISOString(),
    });
  }

  return result;
}

async function main() {
  const supabaseAdmin = new FakeSupabaseAdmin();

  await sendMessage({
    supabaseAdmin,
    label: "Greeting",
    message: "Hello",
    shouldContain: ["menu", "order"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Menu request",
    message: "Show me what you have",
    shouldContain: ["Meat Pie", "Fruit Juice"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Order items",
    message: "10 meat pies, 5 fruit juice",
    shouldContain: ["delivery", "pickup"],
    shouldNotContain: ["order has been noted"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Delivery selected",
    message: "Delivery please",
    shouldContain: ["address"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Address provided",
    message: "32 Daniel Gemma close",
    shouldContain: ["order summary", "confirmation"],
    shouldNotContain: ["what would you like to order"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Confirm order",
    message: "Yes",
    shouldContain: ["order has been noted"],
  });

  await sendMessage({
    supabaseAdmin,
    label: "Post-order thanks",
    message: "Thank you",
    shouldContain: ["welcome"],
    shouldNotContain: ["place an order now"],
  });

  const items = supabaseAdmin.db.conversation_order_items;

  console.log("\nFinal order items:");
  console.table(
    items.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    })),
  );

  const badAddressItem = items.find((item) =>
    String(item.product_name || "").toLowerCase().includes("daniel"),
  );

  if (badAddressItem) {
    throw new Error("Address was incorrectly saved as an order item.");
  }

  console.log("\n? Sales Agent Core flow test passed.");
}

main().catch((error) => {
  console.error("\n? Sales Agent Core flow test failed.");
  console.error(error);
  process.exit(1);
});
