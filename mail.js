import nodemailer from 'nodemailer';

export async function sendMail(testResults, baseURL) {
    const transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        requireTLS: false,
        tls: {
            rejectUnauthorized: false,
        },
        auth: {
            user: 'donotreply@outamationmail.com',
            pass: 'vmpcmkylbzpjclpn',
        },
        logger: false,
        debug: true,
    });

    // Dynamic Environment
    const ENV = process.env.ENV || 'DEV';

    // Dynamic Project Name
    const projectName = process.env.PROJECT_NAME || 'ODS';

    // Check if any module failed
    const hasFailures = testResults.some((result) => result.status === 'Fail');

     // Dynamic Execution Status
    const executionStatus = hasFailures
        ? 'Failed'
        : 'Passed';

    // Dynamic Subject
    const dynamicSubject =  `${projectName} - Playwright Tests - ${ENV} Environment - ${executionStatus}`;

    // Generate dynamic table rows with failure highlighting
    const tableRows = testResults
        .map(
            (result) => `
                <tr style="color: ${result.status === 'Fail' ? 'red' : 'black'};">
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"> ${result.srNo}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.module}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.status}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.URL}</td>
                </tr>`
        )
        .join('');
        
    const emailContent = `
        <html>
            <body>
                <p>Hi All,</p>
                <p>Here are the testing results of all the available modules of <a href="${baseURL}">Outamate DS URL</a>.</p>
                
                <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Sr No</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Module</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Status</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">URL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <p>Thanks,<br>QA Team</p>
                <table style="width: 600px; border-collapse: collapse;">
                </table>
            </body>
        </html>`;



    const mailOptions = {
        from: 'donotreply@outamationmail.com',
        to: 'foram.amin@outamation.com',
    //    cc: 'tushar.galiya@outamation.com',
        subject: dynamicSubject,
        // subject: hasFailures
        //     ? 'Failed: DS - Web UI Playwright Automation Flow Result'
        //     : 'DS - Web UI Playwright Automation Flow Result',
        html: emailContent,
        priority: 'high', // High importance
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully.');
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}