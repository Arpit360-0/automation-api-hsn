import express from 'express';
const router = express.Router();
import puppeteer from 'puppeteer';

const automation = async (hsncode) => {

    const browser = await puppeteer.launch({ 
        headless: true, 
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto('https://cbic-gst.gov.in/gst-goods-services-rates.html', {
            waitUntil: 'networkidle2',
            timeout: 50000
        });

        const getformcontrooler = await page.$('.form-control')
    const serchbtn = await page.$('i.fa-search');

        if (!serchbtn) {
            console.log("Search button not found");
        }

    await   getformcontrooler.type(hsncode);
    await   serchbtn.click();
      
        await page.waitForSelector('#goods_table');
        
        const tableData = await page.evaluate((hsn) => {
            const table = document.querySelector('#goods_table');
            if (!table || !table.querySelector('tbody')) return [];

            const rows = table.querySelectorAll('tbody tr');
            const result = [];
            
            const normalizedHsn = hsn.replace(/[^0-9]/g, '');
            
            rows.forEach(row => {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 5) {
                    const chapterText = columns[2].textContent.trim();
                    const hsnCodesInCell = chapterText
                        .split(/,|\n/)
                        .map(code => code.trim().replace(/[^0-9]/g, ''))
                        .filter(code => code.length > 0);
                    const matchFound = hsnCodesInCell.some(code => {
                        return code === normalizedHsn || code.includes(normalizedHsn);
                    });
                    
                    if (matchFound) {
                        result.push({
                            schedules: columns[0].textContent.trim(),
                            slNo: columns[1].textContent.trim(),
                            chapterHeading: chapterText,
                            description: columns[3].textContent.trim(),
                            cgstRate: columns[4].textContent.trim(),
                            sgstUtgstRate: columns[5].textContent.trim(),
                            igstRate: columns[6].textContent.trim(),
                            cessRate: columns[7] ? columns[7].textContent.trim() : ''
                        });
                    }
                }
            });

            return result;
        }, hsncode);

        await browser.close();
        return tableData;
        
    } catch (error) {
        console.error('Scraping error:', error);
        await browser.close();
        throw error;
    }
};

router.get("/", (req, res) => {
    return res.json({
        success: true,
        message: "Welcome to the GST Rates API"
    });
});

router.post("/getdata", async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                message: "HSN code is required"
            });
        }
        
        const tableData = await automation(data);
        
        if (tableData.length === 0) {
            return res.json({
                success: true,
                message: `No data found for HSN code: ${data}`,
                count: 0,
                data: []
            });
        }
        
        return res.json({
            success: true,
            message: `Found ${tableData.length} entries for HSN code: ${data}`,
            count: tableData.length,
            data: tableData
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "An error occurred while fetching data"
        });
    }
});

export default router;