/**
 * Brand asset URLs hosted on S3 CDN
 * These are referenced at runtime, not bundled in the project
 */

export const PRODUCT_RENDERS = {
  GRAPE: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png",
  GUAVAMELON: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/WJlnZHNTgkvBPSBy.png",
  "LIME-SPLICE": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/aTyNZHXfUIfGlWJm.png",
  LIME: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/sFvbxoElZGYiwdzr.png",
  MANGO: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/ZADuULiCKfdHBaCC.png",
  "NUTRITIONAL-PANEL": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/mjzkOGNWShpmrcVd.png",
  "ORANGE-DREAM": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/jamkmZyzSniuLaFF.png",
  "PASSION-FRUIT": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/qczqJPgILBpeIxdi.png",
  PINEAPPLE: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/PrsTuEPfcXucajqe.png",
  "PINK-LEMONADE": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/CIoJYNILdBnbXYVB.png",
  RASPBERRY: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/FSmgCTPitfsABMhG.png",
  STRAWLIME: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RYRgaKXWdONmcYfo.png"
};

export const LOGOS = {
  wordmark_white: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/eRzcQWcCLpHlBGZe.png",
  combinationmark_white: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/nMDydnEdTFPdnuJC.png"
};

export function getRandomProductRender(): string {
  const renders = Object.values(PRODUCT_RENDERS);
  return renders[Math.floor(Math.random() * renders.length)];
}
