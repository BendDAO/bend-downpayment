import { task } from "hardhat/config";

import { DRE, initDB, setDRE } from "./utils/DRE";

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(async (_, _DRE) => {
  if (DRE) {
    return;
  }
  console.log("- Enviroment");
  console.log("  - Network :", _DRE.network.name);
  setDRE(_DRE);
  initDB(_DRE.network.name);
  return _DRE;
});
