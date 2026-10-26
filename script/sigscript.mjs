// Canonical SilverScript entry sigscript: argument pushes, then the 4-byte dispatch tag.
// The caller appends the redeem script as one data push.

export function encodeEntry(kaspa, artifact, entryName, args) {
  const contract = artifact.contracts.Vault;
  const entry = contract.entries[entryName];
  if (!entry) throw new Error(`missing entry ${entryName}`);
  if (entry.params.length !== args.length) {
    throw new Error(`${entryName} expects ${entry.params.length} arguments`);
  }
  const builder = new kaspa.ScriptBuilder();
  for (let i = 0; i < entry.params.length; i += 1) {
    pushArg(builder, entry.params[i], args[i]);
  }
  const tag = Buffer.from(entry.dispatch_tag, "hex");
  if (tag.length !== 4) throw new Error(`dispatch tag for ${entryName} is not 4 bytes`);
  builder.addData(tag);
  return builder.drain();
}

export function withRedeem(kaspa, actionHex, redeem) {
  const builder = new kaspa.ScriptBuilder();
  builder.addOps(actionHex);
  builder.addData(Buffer.from(redeem));
  return builder.drain();
}

function pushArg(builder, param, value) {
  const kind = param.type.kind;
  if (kind === "int") {
    builder.addI64(BigInt(value));
    return;
  }
  const bytes = Buffer.from(value);
  const expected = expectedLen(param.type, kind);
  if (expected != null && bytes.length !== expected) {
    throw new Error(`${param.name} is ${bytes.length} bytes, expected ${expected}`);
  }
  builder.addData(bytes);
}

function expectedLen(type, kind) {
  if (kind === "fixed_bytes") return type.len;
  if (kind === "datasig") return 64;
  if (kind === "sig") return 65;
  if (kind === "pubkey") return 32;
  if (kind === "byte") return 1;
  throw new Error(`unsupported argument kind ${kind}`);
}
