import {
    stat,
    open,
    unlink
} from "node:fs/promises";

//-----------------------------------------------------------
// Lock File
//-----------------------------------------------------------
const lockFileFunctions = new Map<string, string[]>();
const lockOwnerCounters = new Map<string, number>();

export function addLockFileFunction(
    lockFile: string,
    functionName: string,
): void {
    const functions = lockFileFunctions.get(lockFile) ?? [];

    if (!functions.includes(functionName)) {
        functions.push(functionName);
    }

    lockFileFunctions.set(lockFile, functions);
}

export function removeLockFileFunction(
    lockFile: string,
    functionName: string,
): boolean {
    const functions = lockFileFunctions.get(lockFile);

    if (!functions) {
        return false;
    }

    const index = functions.indexOf(functionName);

    if (index === -1) {
        return false;
    }

    functions.splice(index, 1);

    if (functions.length === 0) {
        lockFileFunctions.delete(lockFile);
    }

    return true;
}

export function getLockFileFunctions(
    lockFile: string,
): string[] {
    return [...(lockFileFunctions.get(lockFile) ?? [])];
}

export async function acquireLock(
    lockFile: string,
    functionName: string,
): Promise<string> {

    const ownerCount = (lockOwnerCounters.get(functionName) ?? 0) + 1;

    lockOwnerCounters.set(functionName, ownerCount);

    const uniqueFunctionName = `${functionName}_${ownerCount}`;

    const LOCK_STALE_TIMEOUT_MS = 20_000;
    const LOCK_WAIT_TIMEOUT_MS = 25_000;
    const POLL_INTERVAL_MS = 100;
    const startedAt = Date.now();

    while (true) {
        
        // Disabled if some functions may genuinely take a long time to release their lockfile.
        // To enable this depends when you acquire the lock. If you do it before the lastassistantmessage check,
        // tool calls most likely will time this out. If you do it just before the writeFile and it's passed all freshness tests, it will be useful.
        // To stop a crashed/hung process.
        if (Date.now() - startedAt >= LOCK_WAIT_TIMEOUT_MS) {
            throw new Error(
                `Timed out waiting for lock: ${lockFile}`,
            );
        }

        // PM already owns this lock.
        const currentFunctions = lockFileFunctions.get(lockFile);

        if (currentFunctions && currentFunctions.length > 0) {

            addLockFileFunction(lockFile, uniqueFunctionName);

            // console.log(
            //     "===== CC ALREADY OWNS LOCK =====",
            //     lockFile,
            //     "function",
            //     functionName,
            //     "active functions",
            //     getLockFileFunctions(lockFile),
            //     "timestamp",
            //     Date.now(),
            // );

            return uniqueFunctionName;
        }

        try {
            const handle = await open(lockFile, "wx");

            addLockFileFunction(lockFile, uniqueFunctionName);

            // console.log(
            //     "===== CC CREATED LOCK =====",
            //     lockFile,
            //     "function",
            //     functionName,
            //     "active functions",
            //     getLockFileFunctions(lockFile),
            //     "timestamp",
            //     Date.now(),
            // );

            await handle.close();

            return uniqueFunctionName;

        } catch (error) {
            const fsError = error as NodeJS.ErrnoException;

            if (fsError.code !== "EEXIST") {
                throw error;
            }

            // Another CC function may have acquired it
            // while this function was trying to create it.
            const functionsAfterCollision =
                lockFileFunctions.get(lockFile);

            if (
                functionsAfterCollision &&
                functionsAfterCollision.length > 0
            ) {
                addLockFileFunction(lockFile, uniqueFunctionName);

                // console.log(
                //     "===== CC ACQUIRED LOCK AFTER COLLISION =====",
                //     lockFile,
                //     "function",
                //     functionName,
                //     "active functions",
                //     getLockFileFunctions(lockFile),
                //     "timestamp",
                //     Date.now(),
                // );

                return uniqueFunctionName;
            }

            try {
                const stats = await stat(lockFile);
                const lockAge = Date.now() - stats.mtimeMs;

                if (lockAge >= LOCK_STALE_TIMEOUT_MS) {
                    try {
                        await unlink(lockFile);

                        // console.log(
                        //     "===== OTHER PLUGIN STALE LOCK REMOVED BY CC =====",
                        //     lockFile,
                        //     "timestamp",
                        //     Date.now(),
                        // );

                    } catch (error) {
                        const fsError = error as NodeJS.ErrnoException;

                        if (fsError.code !== "ENOENT") {
                            throw error;
                        }
                    }

                    continue;
                }

            } catch (error) {
                const fsError = error as NodeJS.ErrnoException;

                if (fsError.code !== "ENOENT") {
                    throw error;
                }

                continue;
            }

            await new Promise<void>((resolve) =>
                setTimeout(resolve, POLL_INTERVAL_MS),
            );
        }
    }
}

export async function releaseLock(
    lockFile: string,
    functionName: string,
): Promise<void> {
    const removed = removeLockFileFunction(
        lockFile,
        functionName,
    );

    if (!removed) {
        // console.warn(
        //     "===== CC RELEASE LOCK WARNING =====",
        //     lockFile,
        //     "function",
        //     functionName,
        //     "was not registered as owning the lock",
        //     "timestamp",
        //     Date.now(),
        // );

        return;
    }

    const remainingFunctions = getLockFileFunctions(lockFile);

    // console.log(
    //     "===== CC FUNCTION FINISHED =====",
    //     lockFile,
    //     "function",
    //     functionName,
    //     "remaining functions",
    //     remainingFunctions,
    //     "timestamp",
    //     Date.now(),
    // );

    // CC still has functions using this lock.
    if (remainingFunctions.length > 0) {
        return;
    }

    // Last CC function finished.
    try {
        await unlink(lockFile);

        // console.log(
        //     "===== CC RELEASED LOCK =====",
        //     lockFile,
        //     "timestamp",
        //     Date.now(),
        // );
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;

        if (fsError.code !== "ENOENT") {
            throw error;
        }
    }
}