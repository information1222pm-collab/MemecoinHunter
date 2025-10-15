import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface PortfolioMetrics {
  totalValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
}

interface UserInfo {
  email: string;
  firstName?: string;
  subscriptionTier?: string;
}

export class EmailService {
  private fromEmail = 'CryptoHobby <onboarding@resend.dev>';

  async sendDailyPerformanceReport(user: UserInfo, metrics: PortfolioMetrics): Promise<void> {
    const isEnterprise = user.subscriptionTier === 'enterprise';
    const pnlColor = metrics.dailyPnL >= 0 ? '#10b981' : '#ef4444';
    const pnlSign = metrics.dailyPnL >= 0 ? '+' : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Performance Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">Daily Performance Report</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0; font-size: 16px; color: #d1d5db;">Hello ${user.firstName || 'Trader'},</p>
              <p style="margin: 12px 0 0; font-size: 16px; color: #d1d5db;">Here's your daily trading performance summary:</p>
            </td>
          </tr>

          <!-- Key Metrics -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 20px; background-color: #262626; border-radius: 8px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 50%; padding: 12px 0;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Portfolio Value</p>
                          <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: #ffffff;">$${metrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </td>
                        <td style="width: 50%; padding: 12px 0;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Daily P&L</p>
                          <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: ${pnlColor};">${pnlSign}$${Math.abs(metrics.dailyPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p style="margin: 2px 0 0; font-size: 14px; color: ${pnlColor};">${pnlSign}${metrics.dailyPnLPercent.toFixed(2)}%</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 12px 0; border-top: 1px solid #404040;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Total P&L</p>
                          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: ${metrics.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${metrics.totalPnL >= 0 ? '+' : ''}$${Math.abs(metrics.totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </td>
                        <td style="width: 50%; padding: 12px 0; border-top: 1px solid #404040;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Win Rate</p>
                          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #3b82f6;">${metrics.winRate.toFixed(1)}%</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 12px 0; border-top: 1px solid #404040;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Total Trades</p>
                          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #ffffff;">${metrics.totalTrades}</p>
                        </td>
                        <td style="width: 50%; padding: 12px 0; border-top: 1px solid #404040;">
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Active Positions</p>
                          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #ffffff;">${metrics.activePositions}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${!isEnterprise ? `
          <!-- Upgrade CTA -->
          <tr>
            <td style="padding: 30px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">Unlock Enterprise Features</h3>
                    <p style="margin: 12px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Upgrade to Enterprise ($99.99/mo) and get:</p>
                    <ul style="margin: 12px 0 0; padding-left: 20px; font-size: 14px; color: rgba(255,255,255,0.9);">
                      <li style="margin: 6px 0;">Real money trading with broker integration</li>
                      <li style="margin: 6px 0;">Priority ML pattern analysis</li>
                      <li style="margin: 6px 0;">Advanced chart analysis tools</li>
                      <li style="margin: 6px 0;">24/7 premium support</li>
                      <li style="margin: 6px 0;">Custom trading strategies</li>
                    </ul>
                    <a href="https://cryptohobby.app/settings" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #ffffff; color: #10b981; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 14px;">Upgrade Now</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #262626;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <a href="https://cryptohobby.app" style="color: #10b981; text-decoration: none;">Visit Dashboard</a> | 
                <a href="https://cryptohobby.app/settings" style="color: #10b981; text-decoration: none;">Settings</a>
              </p>
              <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} CryptoHobby. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      await resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: `Daily Performance Report - ${metrics.dailyPnL >= 0 ? '📈' : '📉'} ${pnlSign}$${Math.abs(metrics.dailyPnL).toFixed(2)}`,
        html: htmlContent,
      });
      console.log(`✅ Daily performance report sent to ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to send performance report to ${user.email}:`, error);
      throw error;
    }
  }

  async sendFeatureUpdateEmail(user: UserInfo, featureTitle: string, featureDescription: string, featureDetails: string[]): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feature Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);">
              <div style="text-align: center;">
                <div style="display: inline-block; padding: 8px 16px; background-color: rgba(255,255,255,0.2); border-radius: 20px; font-size: 12px; font-weight: 600; color: #ffffff; margin-bottom: 16px;">NEW FEATURE</div>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">Feature Update</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); text-align: center;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0; font-size: 16px; color: #d1d5db;">Hello ${user.firstName || 'Trader'},</p>
              <p style="margin: 16px 0 0; font-size: 16px; color: #d1d5db;">We're excited to announce a new feature on CryptoHobby!</p>
            </td>
          </tr>

          <!-- Feature Details -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 24px; background-color: #262626; border-radius: 8px;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff;">${featureTitle}</h2>
                    <p style="margin: 12px 0 0; font-size: 15px; color: #d1d5db; line-height: 1.6;">${featureDescription}</p>
                    
                    ${featureDetails.length > 0 ? `
                    <div style="margin-top: 20px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9ca3af;">What's Included:</p>
                      <ul style="margin: 12px 0 0; padding-left: 20px; font-size: 14px; color: #d1d5db;">
                        ${featureDetails.map(detail => `<li style="margin: 8px 0;">${detail}</li>`).join('')}
                      </ul>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <a href="https://cryptohobby.app" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">Try It Now</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #262626;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <a href="https://cryptohobby.app" style="color: #8b5cf6; text-decoration: none;">Visit Dashboard</a> | 
                <a href="https://cryptohobby.app/settings" style="color: #8b5cf6; text-decoration: none;">Settings</a>
              </p>
              <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} CryptoHobby. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      await resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: `🚀 New Feature: ${featureTitle}`,
        html: htmlContent,
      });
      console.log(`✅ Feature update email sent to ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to send feature update to ${user.email}:`, error);
      throw error;
    }
  }

  async sendTestEmail(email: string): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #10b981;">Email Service is Working!</h1>
              <p style="margin: 16px 0 0; font-size: 16px; color: #d1d5db;">Your Resend integration is successfully configured.</p>
              <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
                CryptoHobby can now send daily performance reports and feature updates.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      await resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: '✅ CryptoHobby Email Service Test',
        html: htmlContent,
      });
      console.log(`✅ Test email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send test email to ${email}:`, error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
