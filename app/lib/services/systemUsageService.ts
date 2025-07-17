import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Formats uptime from seconds to a human-readable string.
 * @param uptimeInSeconds - The system uptime in seconds.
 * @returns A formatted string e.g., "3 days, 5 hours, 2 minutes".
 */
function formatUptime(uptimeInSeconds: number): string {
  const days = Math.floor(uptimeInSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeInSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptimeInSeconds % (60 * 60)) / 60);
  
  return `${days}天 ${hours}小时 ${minutes}分钟`;
}

/**
 * Gets system disk usage.
 * Note: This is a simplified implementation for Linux/macOS.
 * @returns A promise that resolves to the disk usage percentage.
 */
async function getDiskUsage(): Promise<number> {
  try {
    // The 'df -h /' command provides disk usage statistics for the root filesystem.
    const { stdout } = await execAsync('df -h /');
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) {
      return 0;
    }
    // The second line contains the usage data. e.g., /dev/vda1  25G  5.2G   19G  22% /
    const parts = lines[1].split(/\s+/);
    const usagePercent = parts[4]; // e.g., '22%'
    return parseInt(usagePercent.replace('%', ''), 10) || 0;
  } catch (error) {
    console.error('Failed to get disk usage:', error);
    // Return 0 if the command fails, e.g., on non-Unix systems.
    return 0;
  }
}

/**
 * Retrieves system usage statistics including uptime, memory, and disk usage.
 * @returns A promise that resolves to an object with system usage data.
 */
export async function getSystemUsage() {
  const uptime = process.uptime();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
  
  const diskUsage = await getDiskUsage();

  return {
    uptime: formatUptime(uptime),
    memoryUsage,
    diskUsage,
  };
}
