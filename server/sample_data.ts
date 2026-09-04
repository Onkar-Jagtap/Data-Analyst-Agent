export function generateSampleBusinessDataset(): Record<string, any>[] {
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const categories: Record<string, string[]> = {
    'Enterprise Software': ['Cloud Analytics Suite', 'AI Model Governance', 'Data Pipeline Pro', 'CyberSecurity Gateway'],
    'Hardware & Devices': ['Server Blade X9', 'IoT Edge Sensor Pack', 'Enterprise Router 40G', 'Smart Hub Terminal'],
    'Professional Services': ['Cloud Migration SOW', 'Architectural Review', 'Security Compliance Audit', 'Data Strategy Sprint'],
    'Developer Tools': ['IDE Enterprise Seat', 'CI/CD Pipeline Builder', 'Code Vulnerability Scanner', 'API Gateway Mesh'],
  };
  const segments = ['Enterprise', 'Mid-Market', 'Small Business', 'Government'];

  const rows: Record<string, any>[] = [];
  const startDate = new Date('2023-01-10');
  const endDate = new Date('2024-11-25');
  const timeSpan = endDate.getTime() - startDate.getTime();

  let orderIdSeq = 10001;

  for (let i = 0; i < 520; i++) {
    orderIdSeq++;
    const randomDate = new Date(startDate.getTime() + Math.random() * timeSpan);
    const dateStr = randomDate.toISOString().split('T')[0];

    const region = regions[Math.floor(Math.random() * regions.length)];
    const catKeys = Object.keys(categories);
    const category = catKeys[Math.floor(Math.random() * catKeys.length)];
    const products = categories[category];
    const product = products[Math.floor(Math.random() * products.length)];
    const segment = segments[Math.floor(Math.random() * segments.length)];

    let quantity = Math.floor(Math.random() * 25) + 1;
    let unitPrice = 150;
    if (category === 'Enterprise Software') unitPrice = 1200;
    if (category === 'Hardware & Devices') unitPrice = 850;
    if (category === 'Professional Services') unitPrice = 2500;
    if (category === 'Developer Tools') unitPrice = 300;

    let revenue = quantity * unitPrice * (0.85 + Math.random() * 0.3);
    let cost = revenue * (0.45 + Math.random() * 0.35);
    let profit = revenue - cost;

    // Introduce realistic imperfections deliberately:
    let regionVal: any = region;
    let revenueVal: any = Math.round(revenue * 100) / 100;
    let costVal: any = Math.round(cost * 100) / 100;
    let profitVal: any = Math.round(profit * 100) / 100;
    let quantityVal: any = quantity;

    // 1. Missing values (in ~14 rows)
    if (i % 38 === 0) {
      regionVal = null;
    } else if (i % 45 === 0) {
      costVal = '';
    } else if (i % 55 === 0) {
      profitVal = 'N/A';
    }

    // 2. Non-numeric strings in numeric column (~8 rows)
    if (i === 17) {
      revenueVal = 'pending_audit';
    } else if (i === 89) {
      revenueVal = 'unknown';
    } else if (i === 142) {
      revenueVal = '$12,450.00'; // Formatted currency string
    } else if (i === 210) {
      revenueVal = 'TBD';
    }

    // 3. Potential Anomalies: Negative revenue/profit representing returns or adjustments (~4 rows)
    if (i === 65 || i === 190 || i === 310) {
      revenueVal = -Math.round(Math.abs(revenue * 0.5));
      profitVal = -Math.round(Math.abs(profit * 1.2));
    }

    // 4. Extreme outliers: Mega enterprise contracts (~5 rows)
    if (i === 105 || i === 245 || i === 380) {
      quantityVal = 180;
      revenueVal = 185000;
      costVal = 75000;
      profitVal = 110000;
    }

    rows.push({
      'Order ID': `ORD-${orderIdSeq}`,
      'Order Date': dateStr,
      'Region': regionVal,
      'Product Category': category,
      'Product': product,
      'Customer Segment': segment,
      'Quantity': quantityVal,
      'Revenue': revenueVal,
      'Cost': costVal,
      'Profit': profitVal,
    });
  }

  // 5. Add exact duplicate rows (6 duplicates)
  for (let d = 0; d < 6; d++) {
    const targetIdx = d * 40 + 10;
    if (rows[targetIdx]) {
      rows.push({ ...rows[targetIdx] });
    }
  }

  return rows;
}
