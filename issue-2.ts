import { PrismaClient } from "@prisma/client";
import {Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout} from 'async-mutex';
import chalk from 'chalk';

const prisma = new PrismaClient();

const aliceName = "Alice";

async function initializeUsers() {
	await prisma.user.deleteMany();

	// Create two users with a starting balance of 1000 each
	await prisma.user.createMany({
		data: [
			{ name: aliceName, balance: 1000 },
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

async function main() {
	// Step 1: Initialize users with a starting balance of 1000 each
	await initializeUsers();

	// Step 2: Fetch user IDs
	const alice = await prisma.user.findFirst({ where: { name: aliceName } });
	if (!alice) return;
	const aliceId = alice.id;

	// Step 3: Simulate concurrent balance updates
	// Alice's balance updates will use mutex for concurrency control.
    const mutex = new Mutex();

	// Step 4: Simulate two concurrent balance updates
	const update1 = mutex.runExclusive(async () => {
        await updateBalanceWithTransaction(aliceId, 500); // Deposit $500
    });

    const update2 = mutex.runExclusive(async () => {
        await updateBalanceWithTransaction(aliceId, -300); // Withdraw $300
    });
	
	await Promise.all([update1, update2]);

    // Step 5: Check the final balances
    const updatedAlice = await prisma.user.findUnique({
        where: { id: aliceId },
    });
    console.log("Expected 1200:");
    console.log(
        "Final Balance for Alice (with transaction):",
        updatedAlice?.balance
    );
}

main()
	.catch((e) => console.error(e))
	.finally(async () => {
		await prisma.$disconnect();
	});
