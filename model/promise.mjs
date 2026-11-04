// The fixed promise. One lock. The number is sompi.
// It is chosen once. There is no price, no step, and no subsidy.
// This file does not execute a script and it does not start a node.

function sompi(value, label) {
  if (!Number.isInteger(value)) throw new Error("bad " + label);
  return value;
}

// The lock has to cover the promise. Zero is not a promise.
export function openAllows(locked, promise) {
  sompi(locked, "lock");
  sompi(promise, "promise");
  return locked > 0 && promise > 0 && promise <= locked;
}

export function afterAdd(locked, promise, added) {
  if (!openAllows(locked, promise) || sompi(added, "add") <= 0) throw new Error("bad add");
  return { locked: locked + added, promise };
}

// The locker can take the cushion. The promise stays covered.
export function withdrawAllows(locked, promise, take) {
  if (!openAllows(locked, promise) || !Number.isInteger(take)) return false;
  return take > 0 && take <= locked - promise;
}

export function afterWithdraw(locked, promise, take) {
  if (!withdrawAllows(locked, promise, take)) throw new Error("bad withdraw");
  return { locked: locked - take, promise };
}

// The bearer takes the promise. The surplus goes back to the locker.
export function claimPays(locked, promise) {
  if (!openAllows(locked, promise)) throw new Error("bad claim");
  return { pay: promise, surplus: locked - promise };
}

export function samePromise(promise, next) {
  sompi(promise, "promise");
  sompi(next, "promise");
  return promise === next;
}

// The fee is another coin. Pay and surplus are the whole lock.
export function feeStaysOut(locked, promise) {
  const paid = claimPays(locked, promise);
  return paid.pay + paid.surplus === locked;
}
