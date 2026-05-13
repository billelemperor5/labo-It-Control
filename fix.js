const fs = require('fs');

const content = fs.readFileSync('script.js', 'utf8');

const anchorTop = "                <td>${p.dept}</td>";
const anchorBottom = "    const date = new Date().toLocaleDateString();";

const topIndex = content.indexOf(anchorTop);
const bottomIndex = content.indexOf(anchorBottom);

if (topIndex === -1 || bottomIndex === -1) {
    console.error("Anchors not found");
    process.exit(1);
}

const theMissingBlock = `                <td>\${p.dept}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-action" onclick="deletePrinter(\${index})" title="Supprimer"><i class="fas fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        \`;
        list.innerHTML += row;
    });
}

function openAddPrinterModal() {
    document.getElementById('addPrinterModal').classList.add('show');
}

function closeAddPrinterModal() {
    document.getElementById('addPrinterModal').classList.remove('show');
}

document.getElementById('addPrinterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newP = {
        model: document.getElementById('pModel').value,
        location: document.getElementById('pLocation').value,
        ip: document.getElementById('pIP').value,
        dept: document.getElementById('pDept').value,
        status: document.getElementById('pStatus').value
    };
    itPrinters.push(newP);
    closeAddPrinterModal();
    renderPrinters();
    showCopyNotification(\`✅ Imprimante \${newP.model} ajoutée au réseau\`);
    e.target.reset();
});

function deletePrinter(index) {
    if (confirm("Voulez-vous vraiment supprimer cette imprimante ?")) {
        itPrinters.splice(index, 1);
        renderPrinters();
    }
}

// =============================================
// PDF VOUCHER GENERATOR
// =============================================
function printVoucher(sn) {
    const asset = itAssets.find(a => a.sn === sn);
    if (!asset) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageW = 210;
    const pageH = 297;
    const mg = 14; 
    const cw = pageW - mg * 2; 
    const logo = (typeof LOGO_B64 !== 'undefined') ? LOGO_B64 : null;

    // Main Dark Modern Background
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setFillColor(56, 189, 248); 
    doc.rect(0, 0, pageW, 1.5, 'F');

    doc.setFillColor(14, 165, 233); 
    doc.triangle(115, 0, pageW, 0, pageW, 48, 'F');
    doc.setFillColor(30, 41, 59); 
    doc.triangle(120, 0, pageW, 0, pageW, 45, 'F');

    if (logo) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 8, 46, 28, 1.5, 1.5, 'F');
        doc.addImage(logo, 'PNG', 14, 10, 42, 24);
    } else {
        doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
        doc.text('LABO-IT', 15, 25);
    }

    doc.setTextColor(148, 163, 184); 
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('DOCUMENT OFFICIEL  •  SERVICE INFORMATIQUE', 68, 16);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('DÉCHARGE DE RESPONSABILITÉ', 68, 26);
    doc.setTextColor(56, 189, 248); 
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('MATÉRIEL INFORMATIQUE', 68, 35);

    doc.setFillColor(241, 245, 249); 
    doc.rect(0, 45, pageW, 11, 'F');
    doc.setFillColor(203, 213, 225); 
    doc.rect(0, 56, pageW, 0.5, 'F');

    doc.setTextColor(71, 85, 105); 
    doc.setFontSize(8.5); doc.setFont('helvetica','bold');
    doc.text('DATE : ' + new Date().toLocaleDateString('fr-FR'), mg, 52);
    
    var sColor = [148, 163, 184]; 
    if(asset.status === 'En Service') sColor = [16, 185, 129];
    else if(asset.status === 'En Maintenance') sColor = [245, 158, 11];
    else if(asset.status === 'En Stock') sColor = [56, 189, 248];
    
    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.circle(pageW / 2 - 15, 50.6, 1.5, 'F');
    doc.setTextColor(15, 23, 42); 
    doc.text('STATUT : ' + (asset.status || 'N/A').toUpperCase(), pageW / 2 - 11, 52);

    doc.text('RÉF : VCH-' + sn + '-' + new Date().getFullYear(), pageW - mg, 52, { align:'right' });

    const colW = cw / 2 - 3;
    const colL = mg;
    const colR = pageW / 2 + 3;
    const cardH = 58;    
    const cardY = 65;    

    function drawCard(x, y, w, h, title, accent, rows) {
        doc.setFillColor(200, 205, 215);
        doc.rect(x + 1.5, y + 1.5, w, h, 'F');
        doc.setFillColor(255,255,255);
        doc.rect(x, y, w, h, 'F');
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(x, y, 4, h, 'F');
        doc.setTextColor(22, 33, 52); doc.setFontSize(9.5); doc.setFont('helvetica','bold');
        doc.text(title, x + 10, y + 10);
        doc.setDrawColor(226,232,240); doc.setLineWidth(0.4);
        doc.line(x + 8, y + 14, x + w - 5, y + 14);
        rows.forEach(function(row, i) {
            var baseY = y + 21 + i * 13;
            doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
            doc.text(row.label.toUpperCase(), x + 10, baseY);
            doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(22,33,52);
            doc.text(String(row.value || 'N/A'), x + 10, baseY + 5.5);
        });
    }

    drawCard(colL, cardY, colW, cardH, 'ÉQUIPEMENT IT', [99,102,241], [
        { label: 'Désignation', value: asset.model },
        { label: 'N° de Série', value: asset.sn },
        { label: 'Spécifications', value: asset.specs }
    ]);

    drawCard(colR, cardY, colW, cardH, 'BÉNÉFICIAIRE', [16,185,129], [
        { label: 'Employé', value: asset.user },
        { label: 'Département', value: asset.dept },
        { label: 'Date de Réception', value: asset.assignedDate || new Date().toLocaleDateString('fr-FR') }
    ]);

    var accY = cardY + cardH + 7;
    if (asset.peripherals) {
        doc.setFillColor(200,205,215); doc.rect(colL+1.5, accY+1.5, cw, 20, 'F');
        doc.setFillColor(255,255,255); doc.rect(colL, accY, cw, 20, 'F');
        doc.setFillColor(245,158,11); doc.rect(colL, accY, 4, 20, 'F');
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
        doc.text('ACCESSOIRES ASSOCIÉS', colL+10, accY+7);
        doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(22,33,52);
        doc.text(asset.peripherals, colL+10, accY+15);
        accY += 27;
    } else {
        accY += 7;
    }

    var termY = accY + 5;
    var terms = [
        "L'employé reconnaît avoir reçu le matériel décrit ci-dessus en bon état de fonctionnement.",
        "L'employé s'engage à utiliser le matériel exclusivement à des fins professionnelles.",
        "En cas de perte, de vol ou de dommage résultant d'une négligence, l'employé peut être tenu responsable.",
        "Le matériel doit être restitué au service IT lors de la fin de contrat ou sur demande."
    ];
    var termBoxH = 8 + terms.length * 7;
    doc.setFillColor(248,250,252); doc.rect(colL, termY, cw, termBoxH, 'F');
    doc.setDrawColor(220,225,235); doc.setLineWidth(0.4);
    doc.rect(colL, termY, cw, termBoxH, 'D');
    doc.setFillColor(99,102,241); doc.rect(colL, termY, 3, termBoxH, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','italic'); doc.setTextColor(80,95,115);
    terms.forEach(function(line, i) {
        doc.text((i+1) + '.  ' + line, colL + 8, termY + 8 + i * 7);
    });

    var sigY = termY + termBoxH + 8;
    var sigH = 38;

    doc.setFillColor(248,250,252); doc.rect(colL, sigY, colW, sigH, 'F');
    doc.setDrawColor(200,205,215); doc.setLineWidth(0.5);
    doc.rect(colL, sigY, colW, sigH, 'D');
    doc.setFillColor(99,102,241); doc.rect(colL, sigY, colW, 3, 'F');
    doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(22,33,52);
    doc.text("SIGNATURE DE L'EMPLOYÉ", colL + colW/2, sigY + 13, { align:'center' });
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
    doc.text('Nom & Prénom lisibles obligatoires', colL + colW/2, sigY + sigH - 6, { align:'center' });

    doc.setFillColor(248,250,252); doc.rect(colR, sigY, colW, sigH, 'F');
    doc.rect(colR, sigY, colW, sigH, 'D');
    doc.setFillColor(16,185,129); doc.rect(colR, sigY, colW, 3, 'F');
    doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(22,33,52);
    doc.text('CACHET & VISA SERVICE IT', colR + colW/2, sigY + 13, { align:'center' });
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
    doc.text('Responsable Informatique', colR + colW/2, sigY + sigH - 6, { align:'center' });

    doc.setFillColor(18,27,44); doc.rect(0, 279, pageW, 18, 'F');
    doc.setFillColor(99,102,241); doc.rect(0, 279, 6, 18, 'F');
    doc.setFillColor(79,82,221); doc.rect(0, 279, pageW, 1.5, 'F');
    doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
    doc.text('LABO-IT CONTROL  •  Système de Gestion du Parc Informatique  •  Nedjma', pageW/2, 290, { align:'center' });
    doc.setTextColor(99,102,241);
    doc.text('RÉF: VCH-' + sn, pageW - mg, 290, { align:'right' });

    doc.save('Decharge_' + asset.sn + '_' + asset.user.replace(/ /g,'_') + '.pdf');
    showCopyNotification('✅ Document PDF généré pour ' + asset.sn);
}

function generateInventoryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('RAPPORT GLOBAL D\\'INVENTAIRE IT - LABO-IT CONTROL', 148, 20, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    // doc.setFontSize(10); // this is the start of anchorBottom
`;

const newContent = content.substring(0, topIndex) + theMissingBlock + content.substring(bottomIndex);
fs.writeFileSync('script.js', newContent, 'utf8');
console.log("Success");
