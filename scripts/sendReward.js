import { ethers } from "ethers";
import { env, fmt, getProvider, getWallet, loadDeployment, contractAt } from "./common.js";

// Імітація отримання винагороди протоколом: звичайний ERC-20 переказ Токена B на адресу сховища
const provider = getProvider();
const wallet = getWallet(provider);
const d = loadDeployment();
const tokenB = contractAt("MockToken", d.tokenB, wallet);

const amount = ethers.parseUnits(env("REWARD_AMOUNT", "100"), 18);
const tx = await tokenB.transfer(d.vault, amount);
await tx.wait();

console.log(`Надіслано ${fmt(amount)} VTB на адресу сховища ${d.vault}`);
console.log(`tx: ${tx.hash}`);
console.log(`Баланс VTB у сховищі: ${fmt(await tokenB.balanceOf(d.vault))}`);
