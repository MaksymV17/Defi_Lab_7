import { ethers } from "ethers";
import {
  env, fmt, deadline, DEFAULT_ROUTER, EXPLORER,
  getProvider, getWallet, deployContract, contractAt, saveDeployment,
} from "./common.js";

const provider = getProvider();
const wallet = getWallet(provider);
const routerAddress = env("ROUTER_ADDRESS", DEFAULT_ROUTER);

console.log(`Гаманець: ${wallet.address}`);
console.log(`Баланс: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH\n`);

// 1) Два ERC-20 токени: A (базовий актив) і B (винагорода)
const tokenA = await deployContract("MockToken", ["Vertii Token A", "VTA"], wallet);
const tokenB = await deployContract("MockToken", ["Vertii Token B", "VTB"], wallet);
const addrA = await tokenA.getAddress();
const addrB = await tokenB.getAddress();
console.log(`Токен A (базовий):    ${addrA}`);
console.log(`Токен B (винагорода): ${addrB}`);

await (await tokenA.mint(wallet.address, ethers.parseUnits("1000000", 18))).wait();
await (await tokenB.mint(wallet.address, ethers.parseUnits("1000000", 18))).wait();

// 2) Uniswap V2: перевіряємо роутер і створюємо пул A/B з ліквідністю 1:1
const routerAbi = [
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
];
if ((await provider.getCode(routerAddress)).length <= 2) {
  throw new Error(`За адресою роутера ${routerAddress} немає контракту у цій мережі`);
}
const router = new ethers.Contract(routerAddress, routerAbi, wallet);
console.log(`\nUniswap V2 Router: ${routerAddress}`);
console.log(`  factory: ${await router.factory()}`);

const liquidity = ethers.parseUnits("100000", 18);
await (await tokenA.approve(routerAddress, liquidity)).wait();
await (await tokenB.approve(routerAddress, liquidity)).wait();
await (await router.addLiquidity(addrA, addrB, liquidity, liquidity, 0, 0, wallet.address, deadline())).wait();
console.log(`Додано ліквідність у пул A/B: ${fmt(liquidity)} + ${fmt(liquidity)}`);

// 3) Сховище
const vault = await deployContract("AutoCompoundVault", [addrA, addrB, routerAddress], wallet);
const vaultAddr = await vault.getAddress();
console.log(`\nAutoCompoundVault: ${vaultAddr}`);
console.log(`Etherscan: ${EXPLORER}/address/${vaultAddr}`);

saveDeployment({ tokenA: addrA, tokenB: addrB, router: routerAddress, vault: vaultAddr });
console.log("Адреси збережено у deployment.json");
