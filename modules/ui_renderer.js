// modules/ui_renderer.js
// เวอร์ชันอัปเดต: รองรับช่องกรอกระยะห่าง (ไดนามิก)

export function renderCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    let html = '';
    for (let i = 1; i <= count; i++) {
        // ปรับ Label ให้สื่อความหมายตามประเภทงาน
        const distLabel = prefix === 'light' 
            ? `<div class="grid grid-cols-2 gap-2">
                 <div><label class="text-xs text-slate-500">ระยะตู้→สวิตช์ (ม.)</label><input type="number" id="${prefix}_circuit_${i}_dist_panel_to_switch" class="form-input w-full" placeholder="0"></div>
                 <div><label class="text-xs text-slate-500">ระยะสวิตช์→โคม (ม.)</label><input type="number" id="${prefix}_circuit_${i}_dist_switch_to_light" class="form-input w-full" placeholder="0"></div>
               </div>`
            : `<div><label class="text-sm text-slate-600">ระยะตู้ไฟถึงจุดแรก (ม.)</label><input type="number" id="${prefix}_circuit_${i}_panel_dist" class="form-input w-full" placeholder="0"></div>`;

        html += `
            <div class="circuit-container bg-gray-50 p-4 rounded-lg border border-gray-200 mb-3" data-circuit-id="${prefix}-${i}">
                <p class="font-bold text-blue-600 mb-2">วงจรที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${distLabel}
                    <div>
                        <label class="text-sm text-slate-600">จำนวนจุดในวงจร</label>
                        <input type="number" id="${prefix}_circuit_${i}_points" data-prefix="${prefix}" data-index="${i}" class="point-count-input form-input w-full" value="1" min="1">
                    </div>
                </div>
                
                <!-- พื้นที่สำหรับช่องกรอกระยะห่างเพิ่มเติม (จะถูกเติมโดย renderDynamicInputs) -->
                <div id="${prefix}_circuit_${i}_extra_dist_container" class="mt-3 pl-4 border-l-4 border-blue-100"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

export function renderDynamicInputs(prefix, index, points) {
    const container = document.getElementById(`${prefix}_circuit_${index}_extra_dist_container`);
    if (!container) return;

    if (points <= 1) {
        container.innerHTML = ''; // ถ้ามีจุดเดียว ไม่ต้องถามระยะห่าง
        return;
    }

    const unitLabel = prefix === 'socket' ? 'ซม.' : 'ม.';
    const hintText = prefix === 'socket' 
        ? 'ระยะห่างจากจุดก่อนหน้า (ซม.)' 
        : 'ระยะห่างจากจุด/บล็อกก่อนหน้า (ม.)';

    let html = `<p class="text-xs text-blue-600 font-semibold mb-2">${hintText}:</p>`;
    html += `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">`;
    
    for (let j = 1; j < points; j++) {
        html += `
            <div>
                <label class="text-[10px] text-slate-500">จุดที่ ${j} → ${j+1}</label>
                <input type="number" class="extra-dist-input form-input w-full py-1 text-sm" 
                       data-circuit="${prefix}-${index}" 
                       placeholder="0">
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

export function renderDedicatedCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    const isAc = prefix === 'ac_wiring';
    const unitSelectorLabel = isAc ? 'ขนาด BTU' : 'ขนาด Watt';
    // ... (ตัวเลือก BTU/Watt คงเดิม) ...
    const unitOptions = isAc 
        ? `<option value="12000">9,000 - 12,000 BTU</option><option value="18000">12,001 - 18,000 BTU</option><option value="24000">18,001 - 24,000 BTU</option><option value="30000">> 24,000 BTU</option>`
        : `<option value="3500">< 3,500 W</option><option value="4500">3,501 - 4,500 W</option><option value="6000">4,501 - 6,000 W</option>`;

    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `
            <div class="circuit-container bg-gray-50 p-3 rounded mb-2">
                <p class="font-semibold text-gray-800">เครื่องที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <div><label class="text-sm text-slate-600">${unitSelectorLabel}</label><select id="${prefix}_${i}_unit_size" class="form-input w-full">${unitOptions}</select></div>
                    <div><label class="text-sm text-slate-600">ระยะตู้→เครื่อง (ม.)</label><input type="number" id="${prefix}_${i}_dist" class="form-input w-full" placeholder="0"></div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

export function formatCurrency(num) {
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function createSummaryTable(summaryItems) {
    let rows = summaryItems.map(item => `
        <tr>
            <td class="px-6 py-2 text-right font-semibold text-slate-700 ${item.isTotal ? 'text-base' : ''}">${item.label}</td>
            <td class="px-6 py-2 text-right font-bold w-1/3 ${item.isTotal ? 'text-lg text-red-600' : ''}">${formatCurrency(item.value)}</td>
        </tr>
    `).join('');
    return `<div class="mt-8 flex justify-end"><table class="w-full md:w-2/3 lg:w-1/2 text-sm">${rows}</table></div>`;
}
