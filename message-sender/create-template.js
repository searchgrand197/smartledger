// Run once: node create-template.js  — creates sample Excel template
const XLSX = require('xlsx');

const data = [
  ['Name',       'Phone',         'Image URL',                                              'Caption'          ],
  ['Customer 1', '919034147926',  'https://foodporium.in/media/images/Farmhouse_pizza_9R9jJm4.jpg', 'My offer is ready!'],
  ['Customer 2', '918295110043',  'https://foodporium.in/media/images/Farmhouse_pizza_9R9jJm4.jpg', 'Special deal for you'],
  ['Customer 3', '917988776405',  '',                                                       'Hello from us!'],
];

const ws = XLSX.utils.aoa_to_sheet(data);
ws['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 60 }, { wch: 30 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
XLSX.writeFile(wb, 'template.xlsx');
console.log('✅ template.xlsx created!');
