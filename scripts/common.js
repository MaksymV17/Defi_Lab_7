import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

export const EXPLORER = "https://sepolia.etherscan.io";
// Uniswap V2 Router02 у мережі Sepolia
export const DEFAULT_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

export function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Задайте ${name} у файлі .env`);
  return v;
}

export function getProvider() {
  return new ethers.JsonRpcProvider(env("SEPOLIA_RPC_URL"));
}

export function getWallet(provider) {
  return new ethers.Wallet(env("PRIVATE_KEY"), provider);
}

export function loadArtifact(name) {
  const file = path.resolve("artifacts", "contracts", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Немає ${file}. Спочатку виконайте: npx hardhat compile`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function saveDeployment(data) {
  fs.writeFileSync("deployment.json", JSON.stringify(data, null, 2));
}

export function loadDeployment() {
  if (!fs.existsSync("deployment.json")) throw new Error("Немає deployment.json. Спочатку: npm run deploy");
  return JSON.parse(fs.readFileSync("deployment.json", "utf8"));
}

export function contractAt(name, address, signerOrProvider) {
  return new ethers.Contract(address, loadArtifact(name).abi, signerOrProvider);
}

export async function deployContract(name, args, signer) {
  const { abi, bytecode } = loadArtifact(name);
  const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args);
  await c.waitForDeployment();
  return c;
}

export const fmt = (v) => ethers.formatUnits(v, 18);
export const deadline = () => Math.floor(Date.now() / 1000) + 600;
