import { ethers } from "ethers";
import { fmt, EXPLORER, getProvider, getWallet, loadDeployment, contractAt } from "./common.js";

const provider = getProvider();
const wallet = getWallet(provider);
const d = loadDeployment();
const tokenA = contractAt("MockToken", d.tokenA, wallet);
const tokenB = contractAt("MockToken", d.tokenB, wallet);
const vault = contractAt("AutoCompoundVault", d.vault, wallet);

const DEPOSIT = ethers.parseUnits("1000", 18);
const ONE_SHARE = ethers.parseUnits("1", 18);

console.log("=== Життєвий цикл інвестора в AutoCompoundVault ===\n");

// a) Депозит 1000 одиниць базового активу
const sharesBefore = await vault.balanceOf(wallet.address);
await (await tokenA.approve(d.vault, DEPOSIT)).wait();
await (await vault.deposit(DEPOSIT, wallet.address)).wait();
const shares = await vault.balanceOf(wallet.address);

console.log(`a) Депозит: ${fmt(DEPOSIT)} VTA`);
console.log(`   Отримано акцій (Shares): ${fmt(shares - sharesBefore)}`);

// Вартість акцій ДО компаундингу
const assetsBefore = await vault.convertToAssets(shares);
const priceBefore = await vault.convertToAssets(ONE_SHARE);
console.log(`\n   ДО компаундингу:`);
console.log(`   totalAssets:               ${fmt(await vault.totalAssets())} VTA`);
console.log(`   convertToAssets(shares):   ${fmt(assetsBefore)} VTA`);
console.log(`   Ціна 1 акції:              ${fmt(priceBefore)} VTA`);
console.log(`   Винагорода (VTB) у сховищі: ${fmt(await tokenB.balanceOf(d.vault))}`);

// b) compound(): продаж Токена B за Токен A через Uniswap V2
console.log(`\nb) Виклик compound()...`);
const tx = await vault.compound();
const receipt = await tx.wait();
console.log(`   tx: ${tx.hash} (блок ${receipt.blockNumber})`);
console.log(`   Etherscan: ${EXPLORER}/tx/${tx.hash}`);

// c) Вартість акцій ПІСЛЯ компаундингу
const assetsAfter = await vault.convertToAssets(shares);
const priceAfter = await vault.convertToAssets(ONE_SHARE);
console.log(`\nc) ПІСЛЯ компаундингу:`);
console.log(`   totalAssets:               ${fmt(await vault.totalAssets())} VTA`);
console.log(`   convertToAssets(shares):   ${fmt(assetsAfter)} VTA`);
console.log(`   Ціна 1 акції:              ${fmt(priceAfter)} VTA`);
console.log(`   Винагорода (VTB) у сховищі: ${fmt(await tokenB.balanceOf(d.vault))}`);
console.log(`\n   Вартість акцій зросла: ${fmt(assetsBefore)} -> ${fmt(assetsAfter)} VTA`);
console.log(`   Прибуток інвестора: +${fmt(assetsAfter - assetsBefore)} VTA`);

// Доказ: знімаємо всі акції й дивимось, скільки VTA повернулося
const balBefore = await tokenA.balanceOf(wallet.address);
await (await vault.redeem(shares, wallet.address, wallet.address)).wait();
const received = (await tokenA.balanceOf(wallet.address)) - balBefore;
console.log(`\nДоказ: redeem(${fmt(shares)} акцій) повернув ${fmt(received)} VTA`);
console.log(received > DEPOSIT
  ? `Користувач може зняти більше, ніж поклав: ${fmt(received)} > ${fmt(DEPOSIT)} VTA`
  : "УВАГА: сума виводу не перевищує депозит (чи надсилали винагороду командою npm run reward?)");
