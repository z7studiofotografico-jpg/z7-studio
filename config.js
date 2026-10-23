// Configuração do Firebase do Z7 Studio.
// Estes valores NÃO são secretos: o acesso aos dados é protegido pelas regras do Firestore
// e pelo login de e-mail e senha.
self.Z7_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAoUcT2xsFR0BMBr7jKAzXPlgjogx2VSHU",
    authDomain: "z7-funil-e-repasse.firebaseapp.com",
    projectId: "z7-funil-e-repasse",
    storageBucket: "z7-funil-e-repasse.firebasestorage.app",
    messagingSenderId: "710931472548",
    appId: "1:710931472548:web:66fa1911242594af338631"
  },
  // Donos do app: sempre são administradores e podem cadastrar outras pessoas.
  // O primeiro da lista é o administrador principal.
  donos: [
    { email: "z7studiofotografico@gmail.com", nome: "Adriano Vinicius" },
    { email: "lucianafanjos@gmail.com", nome: "Luciana Festraets" }
  ],
  // Quem aprova as datas da agenda (formaturas e dias de fotos)
  aprovadores: ["lucianafanjos@gmail.com"],
  // Cloud Messaging → Certificados push da Web → par de chaves
  vapidKey: "BEebSJWBdNL2gNxa5ODFAUZFixQTJH4MSV5vEQfBEbfJEKgMB_mE1tn6tPYdX5D9J4BLMY0cDQA9Jujot_TzHy8"
};
