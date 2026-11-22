# Modelo do workbook digital de curso on-line

Base reaproveitável do workbook digital da turma (Gino Terentim · Rethinking Learning).

- `build.py`, `src/` (estilo, `app.js`, `conta.js`, `duvidas.js`, `painel.js`, ícones e imagens) e `conteudo.json` formam o site estático, publicado pelo GitHub Pages a partir de `docs/`.
- `modelo/servico/Codigo.gs` é o serviço do Google Apps Script, com os campos de cada turma em branco: o ID da planilha privada, o e-mail do instrutor, o sal do código de acesso, o endereço do site e a lista de encontros.
- As notas do professor (`professor_notas.json`), a cópia real do serviço (`apps-script/`) e a versão do professor (`professor/`) não entram no repositório.
- Nenhum dado de participante entra no repositório: e-mails, códigos, respostas e dúvidas ficam só na planilha privada da turma.
