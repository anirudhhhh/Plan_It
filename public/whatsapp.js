// Pure message builders shared by service screens and booking follow-ups.
const money=paise=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100);
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'';
const vehicles={sedan:'Sedan',suv:'SUV',tempo:'Tempo traveller'};
export function serviceDraft(details){
 const d=details,lines=[];
 if(d.request_id)lines.push(`Hi, I’d like an update on my ${d.kind==='pack'?'travel pack':d.kind} booking request.`,`Request: ${d.request_id}`,...(d.status?[`Status: ${d.status}`]:[]));
 else if(d.kind==='ride')lines.push(`Hi, I’d like a ride${d.pickup?' from '+d.pickup:''}${d.drop?' to '+d.drop:''}${date(d.start_date)?' on '+date(d.start_date):''}${d.time?' at '+d.time+' IST':''}.`);
 else if(d.kind==='stay')lines.push(`Hi, I’d like to book a stay${d.title?' at '+d.title:''}${d.destination?' in '+d.destination:''}.`);
 else lines.push(`Hi, I’m interested in${d.title?' the “'+d.title+'”':' a'} travel pack${d.destination?' to '+d.destination:''}.`);
 if(d.request_id&&d.title)lines.push(`Service: ${d.title}`);
 if(d.kind==='ride'){
  if(d.request_id){if(d.pickup)lines.push(`Pickup: ${d.pickup}`);if(d.drop)lines.push(`Drop: ${d.drop}`);if(date(d.start_date))lines.push(`Date: ${date(d.start_date)}`);if(d.time)lines.push(`Departure: ${d.time} IST`);}
  if(d.vehicle)lines.push(`Vehicle: ${vehicles[d.vehicle]||d.vehicle}`);
  if(d.quantity)lines.push(`Passengers: ${d.quantity}`);lines.push(`Journey: ${d.journey_type==='return'?'Return trip':'One way'}`);if(d.journey_type==='return'){if(date(d.return_date))lines.push(`Return: ${date(d.return_date)}${d.return_time?' at '+d.return_time+' IST':''}`);if(d.drop&&d.pickup)lines.push(`Return route: ${d.drop} → ${d.pickup}`);}if(d.pickup_instructions)lines.push(`Pickup instructions: ${d.pickup_instructions}`);
 }else{
  if(date(d.start_date))lines.push(`${d.kind==='stay'?'Check-in':'Start date'}: ${date(d.start_date)}`);
  if(date(d.end_date))lines.push(`${d.kind==='stay'?'Checkout':'End date'}: ${date(d.end_date)}`);
  if(d.room)lines.push(`Room: ${d.room}`);
  if(d.quantity)lines.push(`${d.kind==='stay'?'Guests':'Travellers'}: ${d.quantity}`);
 }
 if(Number.isSafeInteger(d.quote?.total_paise))lines.push(`${d.request_id?'Submitted total':'Website quote'}: ${money(d.quote.total_paise)} (including shown fees and applicable tax)`);
 else lines.push('Price: to be confirmed by the organisers.');
 if(d.contact)lines.push(`Contact: ${d.contact}`);
 lines.push(d.request_id?'Please share an update and the next steps.':'Please confirm availability, the final price and the next steps.');
 return lines.join('\n');
}
export function requestDraft(booking){return serviceDraft({...booking.service_context,...booking.details,kind:booking.kind,start_date:booking.start_date,end_date:booking.end_date,quantity:booking.quantity,contact:booking.contact,request_id:booking.id,status:booking.status,quote:booking.price_snapshot});}
