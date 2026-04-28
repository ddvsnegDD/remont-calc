// PDF generation for B2B estimates using jsPDF
// Note: jsPDF default fonts don't support Cyrillic out of the box.
// We use a workaround: render the report as an HTML element and convert to PDF
// via html2canvas-like approach, OR use a unicode-capable font.
// For simplicity and reliability with Cyrillic, we render text as a lightweight image-free PDF
// using built-in Helvetica with transliteration fallback when needed.
//
// Better approach: jsPDF supports custom fonts. We embed Roboto (a Cyrillic-capable Google Font)
// loaded as base64. To keep this static and avoid huge inline font, we rely on jsPDF's
// addFileToVFS at runtime, fetching the font from a CDN.

async function loadRobotoFont(doc) {
    if (window.__robotoLoaded) return;
    try {
        const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf';
        const fontBoldUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Bold.ttf';
        const [reg, bold] = await Promise.all([
            fetch(fontUrl).then(r => r.arrayBuffer()).then(buf2base64),
            fetch(fontBoldUrl).then(r => r.arrayBuffer()).then(buf2base64),
        ]);
        doc.addFileToVFS('Roboto-Regular.ttf', reg);
        doc.addFileToVFS('Roboto-Bold.ttf', bold);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
        window.__robotoLoaded = true;
    } catch (e) {
        console.warn('Could not load Cyrillic font, falling back', e);
    }
}

function buf2base64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

async function generatePDF(calc, user) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    await loadRobotoFont(doc);
    if (window.__robotoLoaded) doc.setFont('Roboto', 'normal');

    const r = calc.result;
    const margin = 18;
    const pageW = 210;
    const pageH = 297;
    let y = margin;

    // Helper functions
    const setFont = (size, weight = 'normal') => {
        doc.setFontSize(size);
        if (window.__robotoLoaded) doc.setFont('Roboto', weight);
        else doc.setFont('helvetica', weight);
    };
    const setColor = (hex) => {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        doc.setTextColor(r, g, b);
    };
    const text = (str, x, opts = {}) => {
        const { align = 'left', maxW } = opts;
        if (maxW) {
            const lines = doc.splitTextToSize(str, maxW);
            for (const line of lines) {
                doc.text(line, x, y, { align });
                y += (opts.lh || 5);
            }
        } else {
            doc.text(str, x, y, { align });
        }
    };
    const hr = (color = '#d4d8e0') => {
        const c = [parseInt(color.slice(1,3),16), parseInt(color.slice(3,5),16), parseInt(color.slice(5,7),16)];
        doc.setDrawColor(...c);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
    };
    const space = (n) => { y += n; };
    const checkPage = (needed = 30) => {
        if (y + needed > pageH - margin) {
            doc.addPage();
            y = margin;
        }
    };

    // === HEADER BANNER ===
    doc.setFillColor(201, 123, 72);
    doc.rect(0, 0, pageW, 40, 'F');
    setColor('#ffffff');
    setFont(22, 'bold');
    doc.text('РПКМ', margin, 18);
    setFont(11, 'normal');
    doc.text('Ремонт под ключ Москва', margin, 26);
    setFont(9, 'normal');
    doc.text('Ориентировочная смета · конфиденциально (NDA)', margin, 33);

    setFont(10, 'normal');
    doc.text(new Date(calc.timestamp).toLocaleDateString('ru-RU'), pageW - margin, 18, { align: 'right' });
    doc.text('Расчёт № ' + calc.id.slice(-8).toUpperCase(), pageW - margin, 24, { align: 'right' });

    setColor('#1a1f2e');
    y = 52;

    // === PROJECT INFO ===
    setFont(16, 'bold');
    text(calc.projectName || 'Проект без названия', margin);
    space(7);

    setFont(10, 'normal');
    setColor('#6b7088');
    text('Подготовлено для: ' + (user?.name || '—') + ' · ' + (user?.organization || '—'), margin);
    space(7);
    setColor('#1a1f2e');

    space(2);
    hr();
    space(2);

    // === BIG PRICE ===
    setFont(11, 'normal');
    setColor('#6b7088');
    text('Ориентировочная стоимость работ и материалов', margin);
    space(7);
    setFont(22, 'bold');
    setColor('#1e3a5f');
    text(formatRub(r.totalLow) + ' — ' + formatRub(r.totalHigh), margin);
    space(8);
    setFont(10, 'normal');
    setColor('#6b7088');
    text('Цена за м²: ' + r.lowPerM2.toLocaleString('ru-RU') + ' — ' + r.highPerM2.toLocaleString('ru-RU') + ' ₽', margin);
    space(5);
    text('Категория: ' + r.tierLabel + ' · Площадь: ' + r.area + ' м² · Срок: ' + formatDays(r.days), margin);
    space(8);

    setColor('#1a1f2e');
    hr();
    space(3);

    // === BREAKDOWN ===
    setFont(13, 'bold');
    text('Разбивка по статьям', margin);
    space(7);

    setFont(10, 'normal');
    const items = Object.values(r.breakdown);
    for (const item of items) {
        checkPage(12);
        setFont(11, 'bold');
        setColor('#1a1f2e');
        text(item.label, margin);
        setFont(11, 'normal');
        setColor('#1e3a5f');
        text(formatRub(item.low) + ' – ' + formatRub(item.high), pageW - margin, { align: 'right' });
        space(7);
        // Thin separator
        doc.setDrawColor(240, 242, 246);
        doc.line(margin, y - 2, pageW - margin, y - 2);
    }

    space(4);
    setColor('#1a1f2e');
    hr();
    space(3);

    // === PARAMETERS ===
    checkPage(60);
    setFont(13, 'bold');
    text('Параметры расчёта', margin);
    space(7);

    setFont(10, 'normal');
    const colW = (pageW - 2 * margin) / 2;
    const entries = Object.entries(r.modifiers);
    let col = 0;
    let startY = y;
    for (const [k, v] of entries) {
        if (col === 0 && y + 12 > pageH - margin) {
            doc.addPage();
            y = margin;
            startY = y;
        }
        const x = margin + col * colW;
        setColor('#6b7088');
        doc.text(k, x, y);
        setColor('#1a1f2e');
        if (window.__robotoLoaded) doc.setFont('Roboto', 'bold');
        doc.text(String(v), x, y + 5);
        if (window.__robotoLoaded) doc.setFont('Roboto', 'normal');

        col++;
        if (col >= 2) { col = 0; y += 12; }
    }
    if (col > 0) y += 12;

    space(4);
    setColor('#1a1f2e');
    hr();
    space(3);

    // === METHODOLOGY ===
    checkPage(50);
    setFont(13, 'bold');
    text('Методология расчёта', margin);
    space(7);
    setFont(9, 'normal');
    setColor('#4a5161');
    const method = 'Расчёт ведётся по единой методике: рыночная стоимость работ × коэффициент сложности × конъюнктурный анализ материалов. Бот даёт ориентировочную сумму на основании средней стоимости 1 м² по категориям и факторов сложности (тип здания, этажность, тип отделки, инженерные системы, авторский надзор). Точная итоговая стоимость формируется после разработки проектной документации и составления спецификаций материалов — это работа сметчика.';
    text(method, margin, { maxW: pageW - 2 * margin, lh: 4.5 });
    space(2);

    // === DISCLAIMER ===
    checkPage(30);
    space(4);
    doc.setFillColor(250, 243, 238);
    doc.roundedRect(margin, y, pageW - 2 * margin, 22, 3, 3, 'F');
    setFont(8, 'bold');
    setColor('#c97b48');
    doc.text('КОНФИДЕНЦИАЛЬНО · NDA', margin + 4, y + 6);
    setFont(8, 'normal');
    setColor('#4a5161');
    doc.text(
        'Документ подготовлен исключительно для пользователя. Запрещено передавать третьим\n' +
        'лицам без согласия РПКМ. Расчёт носит информационный характер, не является публичной\n' +
        'офертой. Действителен 30 календарных дней с даты составления.',
        margin + 4, y + 11
    );
    y += 30;

    // === FOOTER ===
    setFont(8, 'normal');
    setColor('#8b91a3');
    doc.text('РПКМ · Ремонт под ключ Москва · сделано в Claude Code',
        pageW / 2, pageH - 8, { align: 'center' });

    // Save
    const safeName = (calc.projectName || 'project').replace(/[^a-zа-яё0-9_\-]/gi, '_').slice(0, 40);
    doc.save(`smeta_${safeName}_${calc.id.slice(-6)}.pdf`);
}
