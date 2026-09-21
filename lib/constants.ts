export const CATEGORIES=["Amministrazione","Assicurazioni","Automezzi","Certificazioni","Contratti","Fiscale","Pagamenti","Personale","Sicurezza","Agricoltura / Campagne","Granaio Italia / SIAN","Macchinari","Manutenzioni","Bandi / Finanziamenti","Clienti / Fornitori","Altro"];

export const CATEGORY_COLORS:Record<string,{backgroundColor:string;color:string;borderColor:string}>={
  "Amministrazione":{backgroundColor:"#e8f1ff",color:"#245a9b",borderColor:"#b8d2f3"},
  "Assicurazioni":{backgroundColor:"#fff0e5",color:"#a94f08",borderColor:"#f5c7a4"},
  "Automezzi":{backgroundColor:"#eaf7f0",color:"#1e6a45",borderColor:"#b9dfc9"},
  "Certificazioni":{backgroundColor:"#f3ecff",color:"#6b3fa0",borderColor:"#d6c1f2"},
  "Contratti":{backgroundColor:"#fff8d9",color:"#7a6412",borderColor:"#e7d58d"},
  "Fiscale":{backgroundColor:"#fdecec",color:"#9f3636",borderColor:"#edbdbd"},
  "Pagamenti":{backgroundColor:"#e7f7f7",color:"#1e6c72",borderColor:"#b6dddf"},
  "Personale":{backgroundColor:"#fcecf5",color:"#99446f",borderColor:"#e8bed3"},
  "Sicurezza":{backgroundColor:"#fff0f0",color:"#a33131",borderColor:"#f2b5b5"},
  "Agricoltura / Campagne":{backgroundColor:"#e8f4e1",color:"#3f6f2f",borderColor:"#c2daaf"},
  "Granaio Italia / SIAN":{backgroundColor:"#f4efe3",color:"#766020",borderColor:"#dccfa4"},
  "Macchinari":{backgroundColor:"#eef0f3",color:"#4c5968",borderColor:"#cbd0d7"},
  "Manutenzioni":{backgroundColor:"#fff3df",color:"#925c11",borderColor:"#e7c99a"},
  "Bandi / Finanziamenti":{backgroundColor:"#e9f0ff",color:"#3d5e9e",borderColor:"#bccbf0"},
  "Clienti / Fornitori":{backgroundColor:"#ebf7f3",color:"#28705a",borderColor:"#b5ddcf"},
  "Altro":{backgroundColor:"#f0f0f0",color:"#5d6266",borderColor:"#d5d7d9"}
};

export function categoryStyle(category:string){
  return CATEGORY_COLORS[category]||CATEGORY_COLORS["Altro"];
}

export const PRIORITY_LABEL={NORMAL:"Normale",IMPORTANT:"Importante",URGENT:"Urgente"} as const;
export const STATUS_LABEL={TODO:"Da fare",IN_PROGRESS:"In gestione",WAITING:"In attesa di terzi",COMPLETED:"Completata",CANCELLED:"Annullata"} as const;
