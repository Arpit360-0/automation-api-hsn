import express from 'express';
const router = express.Router();
import puppeteer from 'puppeteer';

const automation = async (hsncode) => {
    const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
    const page = await browser.newPage();
    
    try {
        // Navigate to the GST rates page
        await page.goto('https://cbic-gst.gov.in/gst-goods-services-rates.html', {
            waitUntil: 'networkidle2'
        });

        // Find the search input and button
        const formControl = await page.$('#chapter');
        const searchBtn = await page.$('i.fa.fa-search');

        if (!formControl || !searchBtn) {
            throw new Error("Search elements not found on page");
        }

        // Enter HSN code and click search
        await formControl.type(hsncode);
        await searchBtn.click();

        // Wait for table results to load
        
        // Extract table data
        const tableData = await page.evaluate(() => {
            const table = document.querySelector('#goods_table');
            if (!table) return [];

            const rows = table.querySelectorAll('tbody tr');
            const result = [];

            rows.forEach(row => {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 5) {
                    result.push({
                        schedules: columns[0].textContent.trim(),
                        slNo: columns[1].textContent.trim(),
                        chapterHeading: columns[2].textContent.trim(),
                        description: columns[3].textContent.trim(),
                        cgstRate: columns[4].textContent.trim(),
                        sgstUtgstRate: columns[5].textContent.trim(),
                        igstRate: columns[6].textContent.trim(),
                        cessRate: columns[7] ? columns[7].textContent.trim() : ''
                    });
                }
            });

            return result;
        });

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
        
        return res.json({
            success: true,
            message: "Data fetched successfully",
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