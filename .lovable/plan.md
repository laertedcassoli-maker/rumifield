

## Diagnóstico: dialog de check-in trava em "Aguardando localização" sem saída

### Estado atual de Roger

Roger tem a rota em andamento `PREV-2026-00004` (iniciada hoje, 23/04) com 3 fazendas:
- John Leonardo Petter — ✅ check-in feito 13:35
- BAUKE DIJKSTRA — ⏳ sem check-in
- Leonel Lopes de Almeida — ⏳ sem check-in

Ele está travando ao tentar abrir o check-in numa dessas duas. A rota anterior (PREV-2026-00002) também tem MELKSTAD com check-in feito mas pendente de encerramento (assunto da conversa anterior).

### Causa raiz (código)

Arquivo: `src/components/preventivas/CheckinDialog.tsx`.

Quando o dialog abre, ele dispara `getLocation()` (timeout configurado: 8s). Enquanto `geoLoading = true`:
- A seção "Localização" mostra spinner "Obtendo localização...".
- O **único botão de ação** disponível é `<Button disabled>Aguardando localização...</Button>`.
- O botão "Continuar sem localização" **só aparece depois de `geoError` ser setado**.

Em PWA instalado / WebView do tablet (caso típico do Roger em campo), `navigator.geolocation.getCurrentPosition` pode:
1. Ficar pendurado indefinidamente se a permissão estiver em "prompt" e o usuário não responder ao banner do sistema (que às vezes aparece atrás do app).
2. Não disparar nem `success` nem o callback de erro com `TIMEOUT` se o serviço de localização do SO estiver desligado, dependendo do navegador.
3. Demorar bem mais que 8s para responder em áreas de sinal fraco.

Resultado: Roger fica preso no spinner sem nenhuma forma de prosseguir (a não ser cancelar o dialog inteiro). Não há um caminho explícito para "Tentar novamente / Pular GPS" enquanto a tentativa atual está em curso.

### Plano de correção

Ajuste **somente** em `src/components/preventivas/CheckinDialog.tsx`:

1. **Watchdog interno de 10s no dialog** — Após abrir, se `geoLoading` continuar `true` por 10s sem sucesso nem erro, o dialog força um estado local `geoStuck = true` e exibe um botão **"Continuar sem localização"** mesmo sem `geoError` ter sido disparado. Isso cobre o caso em que a Geolocation API nunca chama callback nenhum.

2. **Botão "Tentar novamente" sempre visível durante loading** — Ao lado do spinner da localização, mostrar um link/botão pequeno "Tentar de novo" que reinicia `getLocation()` (útil quando o usuário sabe que negou por engano ou que o GPS demora).

3. **Sempre permitir prosseguir sem GPS** — Ao invés de só mostrar "Continuar sem localização" quando `geoError` existe, mostrar esse botão como secundário sempre que (`geoStuck` OR `geoError` OR após 10s). O botão primário "Confirmar Check-in" continua aparecendo só quando `hasLocation`.

4. **Aviso explícito em caso de timeout/stuck** — Pequeno texto laranja: *"Não foi possível obter sua localização agora. Você pode tentar novamente ou continuar sem GPS (o registro ficará incompleto)."*

5. **Limpar timer no cleanup do `useEffect`** — para não acionar o estado `geoStuck` depois do dialog fechar.

### Onde NÃO mexer

- `useGeolocation.ts` continua igual (timeout 8s já é razoável; o problema é a UX quando ele não dispara).
- `ExecucaoRota.tsx` / `checkinMutation` continua igual — já é resiliente (salva offline primeiro, sync em background com timeout de 3s).
- Sem migração de banco ou mudança de RLS.

### Ação imediata para o Roger (enquanto não publicamos o fix)

1. No tablet/celular, abrir Configurações → Permissões do app/site → garantir que **Localização está permitida** para `rumifield.lovable.app`.
2. Garantir que o **Serviço de Localização do sistema está ligado** (Android: Configurações → Localização ON; iOS: Ajustes → Privacidade → Serviços de Localização ON).
3. Fechar e reabrir o app, aguardar até 10s no dialog. Se ainda não aparecer botão de confirmar, **cancelar e tentar de novo** (a 2ª tentativa geralmente usa cache do GPS e responde na hora).
4. Em último caso: cancelar o dialog, ativar Wi-Fi/4G por alguns segundos para o GPS assistido (A-GPS) baixar coordenadas e tentar de novo.

Posso aplicar os 5 ajustes acima no `CheckinDialog.tsx`?

