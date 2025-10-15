import { emailService } from './server/services/email-service.js';

const targetEmail = process.argv[2] || 'information1222pm@gmail.com';

console.log(`📧 Sending demo performance email to ${targetEmail}...`);

emailService.sendDemoPerformanceReport(targetEmail)
  .then(() => {
    console.log('✅ Demo email sent successfully!');
    console.log('📬 Check your inbox at:', targetEmail);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to send demo email:', error);
    process.exit(1);
  });
