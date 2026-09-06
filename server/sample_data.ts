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

export interface MultiDepartmentSuite {
  leads: Record<string, any>[];
  marketing: Record<string, any>[];
  sales: Record<string, any>[];
  operations: Record<string, any>[];
  finance: Record<string, any>[];
}

export function generateEnterpriseMultiDepartmentSuite(): MultiDepartmentSuite {
  const campaigns = [
    { id: 'CMP-01', name: 'Enterprise Q3 Push', channel: 'LinkedIn Ads', budget: 35000, target: 'CFO & Tech Leaders' },
    { id: 'CMP-02', name: 'AI Analytics Launch', channel: 'Google Search', budget: 42000, target: 'VP Operations' },
    { id: 'CMP-03', name: 'Cloud Migration Promo', channel: 'Google Search', budget: 28000, target: 'IT Directors' },
    { id: 'CMP-04', name: 'SaaS Growth Hack', channel: 'Meta Campaigns', budget: 30000, target: 'Growth Marketers' },
    { id: 'CMP-05', name: 'CyberSec Direct Mail', channel: 'Outbound Sales', budget: 15000, target: 'CISOs & Security' },
    { id: 'CMP-06', name: 'MidMarket Webinar', channel: 'Organic Search', budget: 8000, target: 'SMB Owners' },
  ];

  const industries = ['FinTech', 'Healthcare', 'E-Commerce', 'Manufacturing', 'SaaS & Cloud'];
  const companySizes = ['10-50', '51-200', '201-1000', '1000+'];
  const reps = ['Sarah Chen', 'Alex Miller', 'Priya Patel', 'Marcus Johnson'];
  const products = [
    { sku: 'SKU-CLD-01', name: 'Cloud Analytics Suite', category: 'Enterprise Software', price: 1800, cogs: 350, weightKg: 0 },
    { sku: 'SKU-SRV-02', name: 'Server Blade X9', category: 'Hardware & Infrastructure', price: 2400, cogs: 1350, weightKg: 28 },
    { sku: 'SKU-SEC-03', name: 'CyberSec Gateway', category: 'CyberSecurity', price: 1500, cogs: 450, weightKg: 6 },
    { sku: 'SKU-IOT-04', name: 'IoT Sensor Pack', category: 'IoT Devices', price: 650, cogs: 280, weightKg: 4 },
    { sku: 'SKU-DEV-05', name: 'API Mesh Platform', category: 'Developer Tools', price: 950, cogs: 200, weightKg: 0 },
  ];
  const warehouses = ['US East (New Jersey)', 'US West (California)', 'EU Central (Frankfurt)', 'APAC (Singapore)'];
  const carriers = ['FedEx Priority', 'DHL Express', 'UPS Freight', 'OnTrac Local'];

  // 1. Leads Dataset (~300 leads)
  const leads: Record<string, any>[] = [];
  const convertedLeadIds: string[] = [];
  const startTs = new Date('2024-01-05').getTime();
  const endTs = new Date('2024-10-25').getTime();

  for (let i = 1; i <= 300; i++) {
    const leadId = `LD-${1000 + i}`;
    const camp = campaigns[Math.floor(Math.random() * campaigns.length)];
    const leadDate = new Date(startTs + Math.random() * (endTs - startTs)).toISOString().split('T')[0];
    const rep = reps[Math.floor(Math.random() * reps.length)];
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const size = companySizes[Math.floor(Math.random() * companySizes.length)];

    // Channel specific conversion dynamics
    let leadScore = Math.floor(Math.random() * 50) + 30;
    if (camp.channel === 'LinkedIn Ads') leadScore += 20;
    if (camp.channel === 'Meta Campaigns') leadScore -= 15;
    if (camp.channel === 'Google Search') leadScore += 10;
    leadScore = Math.max(15, Math.min(99, leadScore));

    let status = 'Qualified';
    if (leadScore > 65 && Math.random() > 0.35) {
      status = 'Converted';
      convertedLeadIds.push(leadId);
    } else if (leadScore < 35 || Math.random() < 0.25) {
      status = 'Lost';
    } else {
      status = 'Nurturing';
    }

    leads.push({
      'Lead_ID': leadId,
      'Created_Date': leadDate,
      'Channel': camp.channel,
      'Campaign_Name': camp.name,
      'Company_Size': size,
      'Industry': industry,
      'Lead_Score': leadScore,
      'Status': status,
      'Associated_Rep': rep,
      'Sales_Cycle_Days': Math.floor(Math.random() * 55) + 12,
    });
  }

  // 2. Marketing Dataset (Aggregated Campaign Spend per Month)
  const marketing: Record<string, any>[] = [];
  const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10'];
  let mktSeq = 101;

  for (const m of months) {
    for (const c of campaigns) {
      const monthSpend = Math.round(c.budget * (0.8 + Math.random() * 0.4));
      const cpc = c.channel === 'LinkedIn Ads' ? 8.5 : c.channel === 'Google Search' ? 4.2 : c.channel === 'Meta Campaigns' ? 1.8 : 3.0;
      const clicks = Math.round(monthSpend / (cpc * (0.9 + Math.random() * 0.2)));
      const impressions = clicks * Math.floor(Math.random() * 35 + 25);

      marketing.push({
        'Campaign_ID': `CMP-${mktSeq++}`,
        'Campaign_Name': c.name,
        'Channel': c.channel,
        'Period_Month': m,
        'Ad_Spend': monthSpend,
        'Impressions': impressions,
        'Clicks': clicks,
        'Target_Audience': c.target,
        'CAC_Budget': Math.round(monthSpend / (Math.max(1, clicks * 0.03))),
      });
    }
  }

  // 3. Sales Dataset (~420 orders)
  const sales: Record<string, any>[] = [];
  const operations: Record<string, any>[] = [];
  const finance: Record<string, any>[] = [];

  let orderSeq = 5001;
  const customers = Array.from({ length: 120 }, (_, idx) => `CUST-${200 + idx}`);

  for (let i = 0; i < 420; i++) {
    const orderId = `ORD-${orderSeq++}`;
    const orderDateObj = new Date(startTs + Math.random() * (endTs - startTs));
    const orderDateStr = orderDateObj.toISOString().split('T')[0];
    const monthStr = orderDateStr.substring(0, 7);

    const cust = customers[Math.floor(Math.random() * customers.length)];
    const leadId = convertedLeadIds[i % convertedLeadIds.length] || `LD-${1000 + (i % 250) + 1}`;
    const prod = products[Math.floor(Math.random() * products.length)];
    const rep = reps[Math.floor(Math.random() * reps.length)];

    const qty = Math.floor(Math.random() * 12) + 1;
    // Discretionary discounting patterns
    let discountPct = 0;
    if (rep === 'Marcus Johnson') discountPct = Math.random() > 0.4 ? 0.25 : 0.15; // High discounter
    else if (Math.random() > 0.6) discountPct = Math.round((Math.random() * 0.2) * 100) / 100;

    const grossRevenue = Math.round(qty * prod.price * (1 - discountPct) * 100) / 100;
    const paymentStatus = i % 40 === 0 ? 'Disputed' : i % 8 === 0 ? 'Net-60' : i % 4 === 0 ? 'Net-30' : 'Paid';

    sales.push({
      'Order_ID': orderId,
      'Order_Date': orderDateStr,
      'Customer_ID': cust,
      'Lead_ID': leadId,
      'Product_SKU': prod.sku,
      'Product_Name': prod.name,
      'Product_Category': prod.category,
      'Sales_Rep': rep,
      'Quantity': qty,
      'List_Price': prod.price,
      'Discount_Pct': discountPct,
      'Gross_Revenue': grossRevenue,
      'Payment_Status': paymentStatus,
    });

    // 4. Operations Dataset (Logistics & Delivery)
    const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const shipDateObj = new Date(orderDateObj.getTime() + (Math.random() * 2 + 1) * 86400000);
    const shipDateStr = shipDateObj.toISOString().split('T')[0];

    // Hardware with UPS Freight has a systemic damage / delay issue!
    let deliveryDays = Math.floor(Math.random() * 5) + 2;
    let isSlaBreach = false;
    let returnStatus = 'Delivered';
    let returnReason = 'None';

    if (carrier === 'UPS Freight' && prod.weightKg > 10) {
      deliveryDays += Math.floor(Math.random() * 6) + 3;
      if (deliveryDays > 6) isSlaBreach = true;
      if (Math.random() < 0.28) {
        returnStatus = 'Returned';
        returnReason = 'Damaged in Transit';
      }
    } else {
      if (deliveryDays > 5) isSlaBreach = true;
      if (Math.random() < 0.04) {
        returnStatus = 'Returned';
        returnReason = Math.random() > 0.5 ? 'Specification Mismatch' : 'Defective Part';
      }
    }

    const baseFulfillment = 18 + prod.weightKg * 4.5 + deliveryDays * 2.5;
    const fulfillmentCost = Math.round(baseFulfillment * 100) / 100;

    operations.push({
      'Fulfillment_ID': `FUL-${7000 + i + 1}`,
      'Order_ID': orderId,
      'Warehouse_Region': warehouse,
      'Carrier': carrier,
      'Ship_Date': shipDateStr,
      'Delivery_Days': deliveryDays,
      'SLA_Breached': isSlaBreach ? 'Yes' : 'No',
      'Fulfillment_Cost': fulfillmentCost,
      'Return_Status': returnStatus,
      'Return_Reason': returnReason,
    });

    // 5. Finance Dataset (Cost Accounting & Net Contribution Margin)
    const totalCogs = Math.round(prod.cogs * qty * 100) / 100;
    const shippingExpense = Math.round((fulfillmentCost * 1.35) * 100) / 100;
    const paymentFee = Math.round((grossRevenue * 0.029 + 0.3) * 100) / 100;
    const overhead = Math.round(grossRevenue * 0.08 * 100) / 100;

    // If returned, revenue is refunded and company still pays logistics!
    const isReturned = returnStatus === 'Returned';
    let netMargin = grossRevenue - totalCogs - shippingExpense - paymentFee - overhead;
    if (isReturned) {
      netMargin = -Math.round((totalCogs * 0.25 + shippingExpense * 1.5 + paymentFee) * 100) / 100;
    } else {
      netMargin = Math.round(netMargin * 100) / 100;
    }

    let marginHealth = 'Healthy';
    if (netMargin < 0) marginHealth = 'Negative';
    else if (netMargin / Math.max(1, grossRevenue) < 0.18) marginHealth = 'Diluted';

    finance.push({
      'Finance_ID': `FIN-${8000 + i + 1}`,
      'Order_ID': orderId,
      'Period_Month': monthStr,
      'COGS_Unit': prod.cogs,
      'Total_COGS': totalCogs,
      'Shipping_Expense': shippingExpense,
      'Payment_Gateway_Fee': paymentFee,
      'Operating_Overhead': overhead,
      'Net_Contribution_Margin': netMargin,
      'Margin_Health': marginHealth,
    });
  }

  return {
    leads,
    marketing,
    sales,
    operations,
    finance,
  };
}
