async function pdfPhoto(photo){
  const response=await fetch('/api/photos/'+photo.id);
  if(!response.ok)throw new Error('Não foi possível carregar uma foto. Tente gerar o PDF novamente.');
  const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),img=new Image();
  try{img.src=objectUrl;await img.decode();const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);return {data:canvas.toDataURL('image/jpeg',.86),width:canvas.width,height:canvas.height};}
  finally{URL.revokeObjectURL(objectUrl);}
}
async function downloadPDF(){
  await flush();
  await loadCompanyBrand();
  const d=structuredClone(S.active);
  const [brandLogo,brandFooter]=await Promise.all([brandImageForPDF('white'),brandImageForPDF('footer')]);
  if(!window.jspdf?.jsPDF)throw new Error('O gerador de PDF não carregou. Atualize o app e tente novamente.');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  pdf.setProperties({title:'Relatório de vistoria - '+d.property,subject:'Vistoria técnica de recebimento de obra',author:d.inspector||d.company||BRAND.name,creator:BRAND.name});
  const green=[26,26,26],orange=[245,139,24],ink=[35,35,35],muted=[112,112,112];const top=brandLogo?50:39,bottom=brandFooter?251:270;let y=top;
  function header(){
    const x=brandLogo?70:18;
    if(brandLogo){const fit=Math.min(44/brandLogo.width,30/brandLogo.height);const w=brandLogo.width*fit,h=brandLogo.height*fit;pdf.addImage(brandLogo.data,brandLogo.format,18+(44-w)/2,5+(30-h)/2,w,h,'rx-company-logo');}
    pdf.setFont('helvetica','bold');pdf.setFontSize(brandLogo?10:11);pdf.setTextColor(...green);pdf.text(d.company||BRAND.name,x,15,{maxWidth:192-x});pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(...muted);pdf.text((d.type==='renovation'?'PÓS-REFORMA':'PÓS-CONSTRUÇÃO')+' | '+dateText(d.date),x,23);pdf.text('Ref. '+d.id.slice(0,8).toUpperCase(),x,29);pdf.setDrawColor(...orange);pdf.setLineWidth(.6);pdf.line(18,brandLogo?40:33,192,brandLogo?40:33);
  }
  function newPage(){pdf.addPage();header();y=top;}
  function ensure(height){if(y+height>bottom){newPage();return true;}return false;}
  function lines(text,width=174,size=10){pdf.setFontSize(size);return pdf.splitTextToSize(String(text||''),width);}
  function para(text,size=10,indent=0){pdf.setFont('helvetica','normal');pdf.setFontSize(size);pdf.setTextColor(...ink);const rows=lines(text,174-indent,size);for(const line of rows){ensure(5);pdf.text(line,18+indent,y);y+=4.7;}y+=3;}
  function heading(text){ensure(17);y+=4;pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.setTextColor(...green);pdf.text(text,18,y,{maxWidth:174});y+=9;}
  function technical(title,key){heading(title);para(d[key]||'Não informado pelo responsável técnico.');}
  header();
  pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.setTextColor(...green);pdf.text('RELATÓRIO DE VISTORIA TÉCNICA',18,y);y+=8;pdf.text('DE RECEBIMENTO DE OBRA',18,y);y+=10;para(d.property,12);para(d.completed?'Vistoria concluída':'RELATÓRIO EM ANDAMENTO - confira os itens não verificados.',9);
  heading('1. IDENTIFICAÇÃO');
  const metadata=[['Empreendimento / imóvel',d.property],['Tipo de imóvel',d.propertyType],['Endereço',d.address],['Unidade / bloco',d.unit],['Área construída',d.area?Number(d.area).toLocaleString('pt-BR')+' m²':''],['Cliente',d.owner],['Construtora responsável',d.builder],['Responsável técnico',d.inspector],['CREA / UF',d.crea],['RNP',d.rnp],['ART',d.art],['Data da vistoria',dateText(d.date)]];
  for(const [label,value] of metadata){ensure(12);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(...muted);pdf.text(label,18,y);y+=4.5;para(value||'Não informado',10);}
  technical('2. LIMITAÇÕES DA INSPEÇÃO','limitations');technical('3. METODOLOGIA DA VISTORIA','methodology');
  heading('4. AMBIENTES E REGISTROS DA VISTORIA');
  const st=stats(d);para(`${st.checked} de ${st.total} itens verificados | ${st.ok} conformes | ${st.issue} ${st.issue===1?'não conformidade':'não conformidades'} | ${st.na} não aplicáveis`,9);if(st.pending)para(`${st.pending} itens ainda não verificados.`,9);
  const colX=[18,61,95],colWidth=[40,31,94];
  function tableHead(){ensure(10);pdf.setFillColor(244,244,244);pdf.rect(18,y-4,174,9,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(...green);['Item','Condição','Observações'].forEach((label,n)=>pdf.text(label,colX[n]+2,y+1));y+=10;}
  for(let rn=0;rn<d.rooms.length;rn++){
    const room=d.rooms[rn];heading('4.'+(rn+1)+' '+room.name);tableHead();
    for(const item of room.items){
      const details=[item.status==='issue'&&item.nonconformity?'NC: '+item.nonconformity:'',item.notes,item.location?'Local: '+item.location:'',item.status==='issue'&&item.recommendation?'Correção recomendada: '+item.recommendation:'',normativeReferencesText(item)].filter(Boolean).join('\n')||'-';
      pdf.setFont('helvetica','normal');
      const cells=[lines(item.title,colWidth[0]-4,9),lines(statusText[item.status],colWidth[1]-4,9),lines(details,colWidth[2]-4,9)];
      const count=Math.max(...cells.map(c=>c.length));
      for(let offset=0;offset<count;offset+=38){
        const chunk=cells.map(c=>c.slice(offset,offset+38));const height=Math.max(...chunk.map(c=>c.length))*4.3+6;
        if(ensure(height+5))tableHead();
        pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(...ink);
        chunk.forEach((cell,n)=>{if(cell.length)pdf.text(cell,colX[n]+2,y,{lineHeightFactor:1.36});});
        y+=height;pdf.setDrawColor(217,226,220);pdf.setLineWidth(.2);pdf.line(18,y-3,192,y-3);
      }
    }
    y+=4;
    for(const item of room.items){
      const photos=photosFor(d,item.id);if(!photos.length)continue;
      ensure(115);pdf.setFont('helvetica','bold');para('Registro fotográfico: '+room.name+' / '+item.title,10);if(item.status==='issue'&&item.nonconformity)para('Não conformidade: '+item.nonconformity,9);if(normativeReferencesText(item,true))para(normativeReferencesText(item,true),9);
      for(let index=0;index<photos.length;index+=2){
        ensure(92);const rowY=y;let maxCaption=0;
        for(let n=0;n<2&&index+n<photos.length;n++){
          const photo=await pdfPhoto(photos[index+n]);const x=18+n*90;const ratio=Math.min(84/photo.width,65/photo.height);const width=photo.width*ratio,height=photo.height*ratio;
          pdf.setFillColor(245,247,245);pdf.rect(x,rowY,84,65,'F');pdf.addImage(photo.data,'JPEG',x+(84-width)/2,rowY+(65-height)/2,width,height,undefined,'FAST');
          pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(...muted);
          const caption=lines(`Foto ${index+n+1} - ${room.name} - ${item.title}${item.location?' - '+item.location:''}`,84,8).slice(0,4);pdf.text(caption,x,rowY+70,{lineHeightFactor:1.3});maxCaption=Math.max(maxCaption,caption.length*3.7);
        }
        y=rowY+74+maxCaption;
      }
    }
  }
  technical('5. CONSIDERAÇÕES TÉCNICAS','considerations');technical('6. RECOMENDAÇÕES','recommendations');technical('7. OBSERVAÇÃO FINAL','finalNote');if(d.notes){heading('OBSERVAÇÕES GERAIS');para(d.notes);}
  ensure(35);y+=12;pdf.setDrawColor(...muted);pdf.line(50,y,160,y);y+=7;para(d.inspector||'Responsável técnico não informado',10);para('Engenheiro(a) civil | '+(d.crea||'CREA não informado')+(d.rnp?' | RNP '+d.rnp:''),9);if(d.art)para('ART '+d.art,9);
  const pageCount=pdf.getNumberOfPages();
  for(let page=1;page<=pageCount;page++){
    pdf.setPage(page);pdf.setDrawColor(...orange);pdf.setLineWidth(.3);const lineY=brandFooter?257:278;pdf.line(18,lineY,192,lineY);pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(...muted);pdf.text('Ref. '+d.id.slice(0,8).toUpperCase()+' | '+(d.completed?'Concluído':'Em andamento'),18,lineY+4);pdf.text(`${page} / ${pageCount}`,192,lineY+4,{align:'right'});
    if(brandFooter){const fit=Math.min(174/brandFooter.width,24/brandFooter.height);const w=brandFooter.width*fit,h=brandFooter.height*fit;pdf.addImage(brandFooter.data,brandFooter.format,18+(174-w)/2,264+(24-h)/2,w,h,'rx-company-footer');}
    pdf.setFontSize(6.5);pdf.setTextColor(...ink);pdf.text(companyCopyright(),105,brandFooter?293:290,{align:'center',maxWidth:174});
  }
  const filename='Relatorio-vistoria-'+d.property.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,70)+'-'+d.date+'.pdf';
  pdf.save(filename);toast('Relatório PDF gerado.');
  return {filename,pages:pageCount};
}
