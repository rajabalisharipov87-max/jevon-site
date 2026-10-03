const constructorGroups: Record<string, string> = {
  "5505": "1",
  "6606": "2",
  "7707": "3",
  "8808": "4",
};

export function canEditConstructorOrder(code: string | null, orderId: unknown): orderId is string {
  return typeof orderId === "string" && /^\d{2}\/[1-4]\d{2}$/.test(orderId) &&
    constructorGroups[code ?? ""] === orderId.split("/")[1][0];
}

export function constructorGroup(code: string | null): string | null {
  return constructorGroups[code ?? ""] ?? null;
}
