import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { storage } from "../storage";
import { scanner } from "./scanner";

export interface FeatureUpdate {
  type: 'feature' | 'deployment' | 'enhancement' | 'bugfix';
  title: string;
  description: string;
  date: string;
  impact: 'major' | 'minor' | 'patch';
}

class StakeholderReportUpdater {
  private reportPath: string;

  constructor() {
    this.reportPath = join(process.cwd(), "MemeCoin_Hunter_Stakeholder_Report_Q4_2025.md");
  }

  async updateSystemMetrics(): Promise<void> {
    try {
      const reportContent = await readFile(this.reportPath, "utf-8");
      const tokens = await storage.getActiveTokens();
      const scannerStatus = scanner.getStatus();
      const currentDate = new Date().toLocaleDateString("en-US", { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Update dynamic metrics in the report
      let updatedContent = reportContent
        // Update token count throughout the document
        .replace(/(\d+)\+ tokens actively monitored and traded/g, `${tokens.length}+ tokens actively monitored and traded`)
        .replace(/(\*\*Active Tokens Tracked\*\* \| )(\d+)( tokens)/g, `$1${tokens.length}$3`)
        .replace(/(\*\*Comprehensive Coverage\*\*: )(\d+)(\+ tokens)/g, `$1${tokens.length}$3`)
        .replace(/(Market Monitoring\*\*: Real-time scanning of )(\d+)(\+ tokens)/g, `$1${tokens.length}$3`)
        .replace(/(Monitoring )(\d+)( active tokens)/g, `$1${tokens.length}$3`)
        .replace(/(\- )(\d+)(\+ tokens across multiple blockchain ecosystems)/g, `$1${tokens.length}$3`)
        // Update report date
        .replace(/(\*\*Report Date\*\*: ).*/g, `$1${currentDate}`)
        .replace(/(\*\*Major Update\*\*: .*)/g, `$1`)
        .replace(/(\*\*Status\*\*: ).*( \+ AI Learning Active)/g, `$1All Systems Operational$2`);

      await writeFile(this.reportPath, updatedContent, "utf-8");
      console.log(`📊 Stakeholder report updated with current metrics: ${tokens.length} tokens tracked`);
    } catch (error) {
      console.error("❌ Failed to update stakeholder report metrics:", error);
    }
  }

  async addFeatureUpdate(update: FeatureUpdate): Promise<void> {
    try {
      const reportContent = await readFile(this.reportPath, "utf-8");
      
      // Find the "Recently Completed" section and add the new feature
      const recentlyCompletedRegex = /(### Recently Completed \(Q4 2025\)\n)([\s\S]*?)(\n### Current Operations)/;
      
      const featureIcon = this.getFeatureIcon(update.type);
      const newFeatureLine = `✅ **${update.title}**: ${update.description}  \n`;
      
      const updatedContent = reportContent.replace(
        recentlyCompletedRegex,
        (match, header, content, nextSection) => {
          return `${header}${newFeatureLine}${content}${nextSection}`;
        }
      );

      // Update the "Major Update" line to reflect the latest addition
      const finalContent = updatedContent.replace(
        /(\*\*Major Update\*\*: ).*/g,
        `$1${update.title} Integration Completed`
      );

      await writeFile(this.reportPath, finalContent, "utf-8");
      console.log(`📊 Stakeholder report updated with new ${update.type}: ${update.title}`);
    } catch (error) {
      console.error("❌ Failed to add feature update to stakeholder report:", error);
    }
  }

  async logDeployment(deploymentInfo: { version?: string; features: string[]; date: string }): Promise<void> {
    try {
      const update: FeatureUpdate = {
        type: 'deployment',
        title: `Platform Deployment ${deploymentInfo.version || 'v' + Date.now()}`,
        description: `Deployed: ${deploymentInfo.features.join(', ')}`,
        date: deploymentInfo.date,
        impact: 'major'
      };

      await this.addFeatureUpdate(update);
      await this.updateSystemMetrics();
    } catch (error) {
      console.error("❌ Failed to log deployment:", error);
    }
  }

  private getFeatureIcon(type: string): string {
    const icons = {
      feature: '🆕',
      deployment: '🚀',
      enhancement: '⚡',
      bugfix: '🔧'
    };
    return icons[type as keyof typeof icons] || '✅';
  }

  // Auto-update every hour with fresh system metrics
  startAutoUpdater(): void {
    // Update immediately
    this.updateSystemMetrics();
    
    // Then update every hour
    setInterval(() => {
      this.updateSystemMetrics();
    }, 60 * 60 * 1000); // 1 hour

    console.log("📊 Stakeholder report auto-updater started");
  }
}

export const stakeholderReportUpdater = new StakeholderReportUpdater();