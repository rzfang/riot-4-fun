/* make a AJAX request.
  @ AJAX Info object, key-value pairs.
  < XMLHttpRequest object. or null as error. */
function AJAX (Info) {
  function StateChange () {
    switch (this.readyState) {
      case 0:
        Info.Bfr();

        break;

      case 1:
      case 2:
      case 3:
        break;

      case 4:
        if (this.status === 200) { Info.OK(this.responseText, this.status, this); }
        else { Info.Err(this.status); }

        Info.End();

        break;
    }
  }

  const DftInfo = {
    URL: '',
    Data: {},
    Files: {},
    Err: () => {}, // Error callback function. optional. 'Sts' = HTTP Status code.
    OK: () => {},
  }; // OK callback function. optional. 'RpsTxt' = Response Text, 'Sts' = HTTP Status code.

  if (typeof Info.URL !== 'string' || Info.URL === '') { return null; }

  Info.Data = (typeof Info.Data === 'object' && Info.Data !== null) ? Info.Data : DftInfo.Data;
  Info.Mthd = Info.Mthd || 'GET';
  Info.Bfr = (typeof Info.Bfr === 'function') ? Info.Bfr : () => {}; // Before callback function. optional.
  Info.Err = (typeof Info.Err === 'function') ? Info.Err : DftInfo.Err;
  Info.OK = (typeof Info.OK === 'function') ? Info.OK : DftInfo.OK;
  Info.End = (typeof Info.End === 'function') ? Info.End : () => {};
  Info.Pgs = (typeof Info.Pgs === 'function') ? Info.Pgs : () => {}; // Progress callback function. optional.

  const FmDt = new FormData(); // 'FmDt' = Form Data.
  const XHR = new XMLHttpRequest();
  let Kys = Object.keys(Info.Data); // 'Kys' = Keys.

  for (let i = 0; i < Kys.length; i++) {
    const Tp = typeof Info.Data[Kys[i]];

    if (Array.isArray(Info.Data[Kys[i]])) {
      const Ky = Kys[i] + '[]';
      const Vl = Info.Data[Kys[i]];

      const Lth = Vl.length;

      for (let j = 0; j < Lth; j++) { FmDt.append(Ky, Vl[j]); }
    }
    else if (Tp === 'string' || Tp === 'number') { FmDt.append(Kys[i], Info.Data[Kys[i]]); }
  }

  if (typeof Info.File === 'object' && Info.File !== null) {
    Kys = Object.keys(Info.File);

    for (let i = 0; i < Kys.length; i++) { FmDt.append(Kys[i], Info.File[Kys[i]]); }
  }

  XHR.timeout = 5000;
  XHR.onreadystatechange = StateChange;
  XHR.upload.onprogress =  Evt => { Info.Pgs(Evt.loaded, Evt.total, Evt); };

  if (Info.Mthd === 'GET') {
    let Url;

    if (Info.URL.substr(0, 1) === '/') {
      Url = new URL(window.location.origin + Info.URL);
    }
    else if (Info.URL.substr(0, 4) === 'http') {
      Url = new URL(window.location.origin);
    }
    else {
      Url = new URL(window.location.origin + '/' + Info.URL);
    }

    Info.URL = Url.pathname +
      '?' +
      (Url.search ? (new URLSearchParams(Url.search).toString() + '&') : '') +
      new URLSearchParams(FmDt).toString();
  }

  XHR.open(Info.Mthd, Info.URL);

  // XHR.overrideMimeType('text/xml');
  XHR.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // to use AJAX way.

  if (typeof Info.Hdrs === 'object' && Info.Hdrs !== null) {
    Kys = Object.keys(Info.Hdrs);

    for (let i = 0; i < Kys.length; i++) { XHR.setRequestHeader(Kys[i], Info.Hdrs[Kys[i]]); }
  }

  if (Info.Mthd === 'GET') { XHR.send(); }
  else { XHR.send(FmDt); }

  return XHR;
}

export class Plugin {
  constructor (Rqst = null) {
    this.Rqst = Rqst;
    this.Srvc = { Rprt: {}, Sto: {}}; // service, report, data store.
  }

  /* do the 'Tsk' function is on the browser environment.
    @ the task function will run on client (browser) side.
    < bool. */
  OnBrowser (Tsk) {
    if (typeof process === 'object') { return false; }

    if (typeof Tsk === 'function') { Tsk(); }

    return true;
  }

  /* do the 'Tsk' function if on the node environment.
    @ the task function will run on server (node) side.
    @ the request object in node.js, otherwise undefined. optional.
    < bool. */
  OnNode (Tsk) {
    if (typeof process !== 'object') { return false; }

    if (typeof Tsk === 'function') { Tsk(this.Rqst); }

    return true;
  }

  /* get a store.
    @ a string of store key.
    < store object, or null. */
  StoreGet (Ky) {
    if (!Ky || typeof Ky !== 'string') { return null; }

    return this.Srvc.Sto[Ky] || null;
  }

  /* currently, this is only used by Store.riot.
    @ name to locate the store.
    @ Then(Sto, PrmsToTsk) = then, a function when the task done.
      @ the store object.
      @ params to task. to locate where the event comes from.
    @ run once in the beginning. */
  StoreListen (StoNm, Then, RnOnc = true) {
    let Clbcks = this.Srvc.Rprt[StoNm] || null;

    if (!Clbcks || !Array.isArray(Clbcks)) {
      this.Srvc.Rprt[StoNm] = [];
      Clbcks = this.Srvc.Rprt[StoNm];
    }

    this.Srvc.Rprt[StoNm].push(Then);

    if (RnOnc && this.Srvc.Sto[StoNm]) { Then(this.Srvc.Sto[StoNm], null); } // if the task store is ready, call once first.
  }

  /* currently, this is only used by Store.riot.
    @ store name.
    @ target report. */
  StoreUnleash (StoNm, TgtRprt) {
    const Rprt = this.Srvc.Rprt[StoNm];

    if (!Rprt) { return; }

    for (let i = 0; i < Rprt.length; i++) {
      if (Rprt[i] === TgtRprt) { this.Srvc.Rprt[StoNm].splice(i, 1); }
    }
  }

  /*
    @ name to locate the store.
    @ NewStoreGet (Sto, Rst) = the function to get new store, this must return something to replace original store.
      @ original store data.
      < new store object.
    @ params object passing to each task.
    < result code. 0 as fine, < 0 as error. */
  StoreSet (StoNm, NewStoreGet, PrmsToTsk) {
    if (!StoNm || typeof StoNm !== 'string' || !NewStoreGet || typeof NewStoreGet !== 'function') { return -1; }

    const Rprt = this.Srvc.Rprt[StoNm] || [];

    const Lnth = Rprt && Array.isArray(Rprt) && Rprt.length || 0;

    this.Srvc.Sto[StoNm] = NewStoreGet(this.Srvc.Sto[StoNm]);

    for (let i = 0; i < Lnth; i++) { Rprt[i](this.Srvc.Sto[StoNm], PrmsToTsk); }

    return 0;
  }

  /* the generated Riot code in browser will call this to initialize Riot-4-Fun Store.
    @ store json string. */
  StoreInject (StoStr) {
    try {
      this.Srvc.Sto = JSON.parse(StoStr);
    }
    catch (Err) {
      console.log(Err); // eslint-disable-line no-console
    }
  }

  /* print store as browser Js code to initialize Riot-4-Fun Store support in browser environment.
    this only works on node.js to generates HTML page source code. */
  StorePrint () {
    const Stos = Object.entries(this.Srvc.Sto);

    if (this.Srvc.Sto.PAGE) {
      this.Srvc.Sto.PAGE = ''; // clean server only store - PAGE.
    }

    // no stores, or only PAGE store.
    if (Stos.length === 0 || (Stos === 1 && Stos[0][1] === 'PAGE')) {
      return `
        <script type='module'>
          import RiotPlugin from 'riot-4-fun/core/plugin.mjs';

          window.riotPlugin = new RiotPlugin();

          window.riot.install(component => window.riotPlugin.Bind(component));
        </script>
      `;
    }

    return '<script id=\'riot-store\' type=\'application/json\'>' + JSON.stringify(this.Srvc.Sto) + '</script>\n' +
      `
        <script type='module'>
          import RiotPlugin from 'riot-4-fun/core/plugin.mjs';

          window.riotPlugin = new RiotPlugin();

          window.riotPlugin.StoreInject(document.getElementById('riot-store').textContent);
          window.riot.install(component => window.riotPlugin.Bind(component));
        </script>
      `;
  }

  /* a service which also take cover Store manage.
    @ URL string, the service entry point.
    @ params object to call service.
    @ name to locate the store.
    @ NewStoreGet (Sto, Rst) = the function to get new store, this must return something to replace original store.
      @ original store data.
      @ result from API.
    @ params object passing to each task. optional.
    @ the service cases object in node.js, otherwise undefined. optional.
    < result code. */
  ServiceCall (Url, Prms, StoNm, NewStoreGet, PrmsToTsk, AjxOptns) {
    let Mthd = 'POST';

    if (typeof Url === 'object' && Url.Mthd) {
      Mthd = Url.Mthd;
      Url = Url.Url;
    }
    else if (typeof Url !== 'string') {
      return -1;
    }

    if (!StoNm || typeof StoNm !== 'string' ||
        !NewStoreGet || typeof NewStoreGet !== 'function')
    { return -2; }

    const Srvc = this.Srvc;

    AJAX({
      ...AjxOptns,
      URL: Url,
      Mthd,
      Data: Prms,
      Err: () => {
        console.log('---- AJAX query fail ----\nUrl: ' + Url + '\nparams:'); // eslint-disable-line no-console
        console.log(Prms); // eslint-disable-line no-console
        console.log('----\n'); // eslint-disable-line no-console

        Srvc.Sto[StoNm] = NewStoreGet(Srvc.Sto[StoNm], '');
      },
      OK: (RspnsTxt, Sts, XHR) => {
        const CntTp = XHR.getResponseHeader('content-type');
        const Rprt = Srvc.Rprt[StoNm] || [];
        let Rst = RspnsTxt;

        const Lnth = Rprt && Array.isArray(Rprt) && Rprt.length || 0;

        if (Rst && (CntTp === 'application/json' || CntTp === 'text/json')) { Rst = JSON.parse(Rst); }

        Srvc.Sto[StoNm] = NewStoreGet(Srvc.Sto[StoNm], Rst);

        for (let i = 0; i < Lnth; i++) { Rprt[i](Srvc.Sto[StoNm], PrmsToTsk); }
      },
    });

    return 0;
  }

  Bind (Cmpnt) {
    Cmpnt.OnBrowser = this.OnBrowser;
    Cmpnt.OnNode = (...Vls) => this.OnNode.apply(this, Vls); // Vls = values.
    Cmpnt.StoreGet = (...Vls) => this.StoreGet.apply(this, Vls);
    Cmpnt.StoreListen = (...Vls) => this.StoreListen.apply(this, Vls); // currently, only Store.riot uses.
    Cmpnt.StoreUnleash = (...Vls) => this.StoreUnleash.apply(this, Vls); // currently, only Store.riot uses.
    Cmpnt.StoreSet = (...Vls) => this.StoreSet.apply(this, Vls);

    if (this.OnBrowser()) {
      Cmpnt.ServiceCall = (...Vls) => this.ServiceCall.apply(this, Vls);
    }

    return Cmpnt;
  }
}

export default Plugin;
