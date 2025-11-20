// =========================================================
// CORE SYSTEM: หัวใจหลักของระบบ (ห้ามแก้ไขถ้าไม่จำเป็น)
// =========================================================

const Core = {
    data: {}, // เก็บข้อมูลทั้งหมดที่โหลดมา
    
    // 1. ตัวโหลดข้อมูล (Data Loader)
    async loadDatabase(url) {
        const statusBadge = document.getElementById('system-status');
        try {
            statusBadge.innerHTML = '⏳ กำลังโหลดฐานข้อมูล...';
            statusBadge.className = "status-badge status-loading";
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network Error");
            this.data = await response.json();
            
            console.log("Database Loaded:", this.data);
            statusBadge.innerHTML = '✅ ระบบพร้อมใช้งาน';
            statusBadge.className = "status-badge status-success";
            
            return true;
        } catch (error) {
            console.error("Load Error:", error);
            statusBadge.innerHTML = '❌ โหลดข้อมูลไม่สำเร็จ (ตรวจสอบเน็ต)';
            statusBadge.className = "status-badge status-error";
            alert("ไม่สามารถโหลดฐานข้อมูลได้ กรุณาตรวจสอบลิงก์ GitHub หรืออินเทอร์เน็ต");
            return false;
        }
    },

    // 2. เครื่องมือช่วย (Helpers)
    el(id) { return document.getElementById(id); },
    
    val(id) { 
        const e = document.getElementById(id); 
        return e ? (parseFloat(e.value) || 0) : 0; 
    },
    
    str(id) { 
        const e = document.getElementById(id); 
        return e ? e.value : ''; 
    },
    
    isChecked(id) { 
        const e = document.getElementById(id); 
        return e ? e.checked : false; 
    },
    
    formatCurrency(num) {
        if (isNaN(num)) return "0.00";
        return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // 3. ฟังก์ชันคำนวณราคาสรุป (Final Calculation)
    calculateFinalPrice(materialCost, laborCost) {
        const wastagePct = this.val('wastage_factor');
        const overheadPct = this.val('overhead_factor');
        const profitPct = this.val('profit_factor');
        const minCharge = this.val('min_charge');
        const vatRate = this.isChecked('include_vat') ? 0.07 : 0;

        let totalMat = materialCost * (1 + wastagePct / 100);
        let totalLab = laborCost;
        let baseTotal = totalMat + totalLab;

        let overhead = baseTotal * (overheadPct / 100);
        let withOverhead = baseTotal + overhead;

        let profit = withOverhead * (profitPct / 100);
        let beforeVat = withOverhead + profit;

        let minChargeAdj = 0;
        if (beforeVat < minCharge) {
            minChargeAdj = minCharge - beforeVat;
            beforeVat = minCharge;
        }

        let vat = beforeVat * vatRate;
        let grandTotal = beforeVat + vat;

        return {
            totalMaterial: totalMat,
            totalLabor: totalLab,
            overhead,
            profit,
            minChargeAdj,
            vat,
            grandTotal
        };
    }
};

// Export ให้ไฟล์อื่นใช้ได้
window.Core = Core;