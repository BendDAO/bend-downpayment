import { assert } from "chai";
import { BigNumber } from "ethers";

export function assertAlmostEqualTol(x: BigNumber, y: BigNumber, tol = 0.1): void {
  tol *= 10 ** 10;
  const target = x
    .sub(y)
    .abs()
    .mul(10 ** 10);
  if (!x.eq(0)) {
    const valueToCheck = target.div(x).toNumber();
    assert.isAtMost(valueToCheck, tol);
  }
  if (!y.eq(0)) {
    const valueToCheck = target.div(y).toNumber();
    assert.isAtMost(valueToCheck, tol);
  }
}
