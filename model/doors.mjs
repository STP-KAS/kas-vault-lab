// Two powers, kept apart. Ordering is who includes the payment.
// The door is who can mint, freeze, or name the price.
// This is not a fee market and not a node.

export function shape(name, fields) {
  return {
    name,
    orderedByMiners: false,
    sequencer: false,
    freezeCirculating: false,
    unboundMint: false,
    quoteKey: false,
    subsidyHaircut: 0,
    priced: false,
    ...fields,
  };
}

export function read(s) {
  const orderingDecentralized = s.orderedByMiners && !s.sequencer;
  const circulatingBearer = !s.freezeCirculating;
  const minersUncut = s.subsidyHaircut === 0;
  return {
    orderingDecentralized,
    circulatingBearer,
    minersUncut,
    // A priced bearer note on miner ordering, with no subsidy cut.
    // A quote key or an unbound mint can still sit on top. Those stay visible.
    fits: orderingDecentralized && circulatingBearer && minersUncut && s.priced,
  };
}

// The user holds notes. The relayer holds KAS. The miner is paid KAS.
// Nobody in this function is a sequencer.
export function paymaster(payment) {
  const { noteToRecipient, noteToRelayer, kasFromRelayer, minerKas } = payment;
  if (noteToRecipient <= 0) throw new Error("no payment");
  if (noteToRelayer < 0) throw new Error("relayer paid the user");
  if (kasFromRelayer !== minerKas) throw new Error("miner was not paid the KAS fee");
  if (minerKas <= 0) throw new Error("no miner fee");
  return {
    userSpentNotes: noteToRecipient + noteToRelayer,
    recipientNotes: noteToRecipient,
    relayerNotes: noteToRelayer,
    minerKas,
    sequencer: null,
  };
}

// Miners can include a freeze transaction. Inclusion is not success.
// The script accepts the spend only when the note is not frozen.
export function spendAllowed(includedByMiner, frozen) {
  if (!includedByMiner) return false;
  return !frozen;
}
