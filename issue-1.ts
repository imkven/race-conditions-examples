import { PrismaClient } from "@prisma/client";
import chalk from 'chalk';

const prisma = new PrismaClient();

const aliceName = "Alice";
const bobName = "Bob";

async function initializeUsers() {
	await prisma.user.deleteMany();

	// Create two users with a starting balance of 1000 each
	await prisma.user.createMany({
		data: [
			{ name: aliceName, balance: 1000 },
			{ name: bobName, balance: 1000 },
		],
	});
}

async function pause() {
    const randomDelay = Math.floor(Math.random() * 1000);
    return await new Promise((resolve) => setTimeout(resolve, randomDelay)); // Simulate delay
}

async function updateBalanceWithTransaction(userId: number, amount: number) {
	// This function uses Prisma's transaction
	return prisma.$transaction(async (prisma) => {
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});
		if (!user) throw new Error("User not found");

		const newBalance = user.balance + amount;
		await pause();

        console.log(`Set balance ${chalk.bold.bgWhite(`${user.name} [$${newBalance}]`)} with transaction...`)

		const updated = await prisma.user.update({
			where: { id: userId },
			data: { balance: newBalance },
		});
        return updated;
	});
}

async function updateBalanceWithoutTransaction(userId: number, amount: number) {
	// This function does NOT use a transaction
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});
	if (!user) throw new Error("User not found");

	const newBalance = user.balance + amount;
    await pause();

    console.log(`Set balance ${chalk.bold.bgWhite(`${user.name} [$${newBalance}]`)} without transaction...`)

	const updated = await prisma.user.update({
		where: { id: userId },
		data: { balance: newBalance },
	});
    return updated;
}

async function main() {
	// Step 1: Initialize users with a starting balance of 1000 each
	await initializeUsers();

	// Step 2: Fetch user IDs
	const alice = await prisma.user.findFirst({ where: { name: aliceName } });
	const bob = await prisma.user.findFirst({ where: { name: bobName } });
	if (!alice || !bob) return;
	const aliceId = alice.id;
	const bobId = bob.id;

	// Step 3: Simulate concurrent balance updates
	// Alice's balance updates will use transactions
	const updateAlice1 = updateBalanceWithTransaction(aliceId, 500); // Deposit $500
	const updateAlice2 = updateBalanceWithTransaction(aliceId, -300); // Withdraw $300

	// Bob's balance updates will NOT use transactions
	const updateBob1 = updateBalanceWithoutTransaction(bobId, 500); // Deposit $500
	const updateBob2 = updateBalanceWithoutTransaction(bobId, -300); // Withdraw $300

	// Step 4: Await all updates to complete
	await Promise.all([updateAlice1, updateAlice2, updateBob1, updateBob2]);

	// Step 5: Check the final balances
	const updatedAlice = await prisma.user.findUnique({
		where: { id: aliceId },
	});
	const updatedBob = await prisma.user.findUnique({ where: { id: bobId } });
    console.log("Expected 1200:");
	console.log(
		"Final Balance for Alice (with transaction):",
		updatedAlice?.balance
	);
	console.log(
		"Final Balance for Bob (without transaction):",
		updatedBob?.balance
	);
}

main()
	.catch((e) => console.error(e))
	.finally(async () => {
		await prisma.$disconnect();
	});
