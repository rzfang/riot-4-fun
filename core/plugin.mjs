/* make a AJAX request.
  @ AJAX info object, key-value pairs.
  < XMLHttpRequest object. or null as error. */
function ajax (info) {
  function stateChange () {
    switch (this.readyState) {
      case 0:
        info.Bfr();

        break;

      case 1:
      case 2:
      case 3:
        break;

      case 4:
        if (this.status === 200) { info.OK(this.responseText, this.status, this); }
        else { info.Err(this.status); }

        info.End();

        break;
    }
  }

  const defaultInfo = {
    URL: '',
    Data: {},
    Files: {},
    Err: () => {}, // Error callback function. optional. 'Sts' = HTTP Status code.
    OK: () => {},
  }; // OK callback function. optional. 'RpsTxt' = Response Text, 'Sts' = HTTP Status code.

  if (typeof info.URL !== 'string' || info.URL === '') { return null; }

  info.Data = (typeof info.Data === 'object' && info.Data !== null) ? info.Data : defaultInfo.Data;
  info.Mthd = info.Mthd || 'GET';
  info.Bfr = (typeof info.Bfr === 'function') ? info.Bfr : () => {}; // Before callback function. optional.
  info.Err = (typeof info.Err === 'function') ? info.Err : defaultInfo.Err;
  info.OK = (typeof info.OK === 'function') ? info.OK : defaultInfo.OK;
  info.End = (typeof info.End === 'function') ? info.End : () => {};
  info.Pgs = (typeof info.Pgs === 'function') ? info.Pgs : () => {}; // Progress callback function. optional.

  const formData = new FormData();
  const xhr = new XMLHttpRequest();
  let keys = Object.keys(info.Data);

  for (let i = 0; i < keys.length; i++) {
    const type = typeof info.Data[keys[i]];

    if (Array.isArray(info.Data[keys[i]])) {
      const key = keys[i] + '[]';
      const value = info.Data[keys[i]];

      const length = value.length;

      for (let j = 0; j < length; j++) { formData.append(key, value[j]); }
    }
    else if (type === 'string' || type === 'number') { formData.append(keys[i], info.Data[keys[i]]); }
  }

  if (typeof info.File === 'object' && info.File !== null) {
    keys = Object.keys(info.File);

    for (let i = 0; i < keys.length; i++) { formData.append(keys[i], info.File[keys[i]]); }
  }

  xhr.timeout = 5000;
  xhr.onreadystatechange = stateChange;
  xhr.upload.onprogress =  event => { info.Pgs(event.loaded, event.total, event); };

  if (info.Mthd === 'GET') {
    let url;

    if (info.URL.substr(0, 1) === '/') {
      url = new URL(window.location.origin + info.URL);
    }
    else if (info.URL.substr(0, 4) === 'http') {
      url = new URL(window.location.origin);
    }
    else {
      url = new URL(window.location.origin + '/' + info.URL);
    }

    info.URL = url.pathname +
      '?' +
      (url.search ? (new URLSearchParams(url.search).toString() + '&') : '') +
      new URLSearchParams(formData).toString();
  }

  xhr.open(info.Mthd, info.URL);

  // xhr.overrideMimeType('text/xml');
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // to use AJAX way.

  if (typeof info.Hdrs === 'object' && info.Hdrs !== null) {
    keys = Object.keys(info.Hdrs);

    for (let i = 0; i < keys.length; i++) { xhr.setRequestHeader(keys[i], info.Hdrs[keys[i]]); }
  }

  if (info.Mthd === 'GET') { xhr.send(); }
  else { xhr.send(formData); }

  return xhr;
}

export class Plugin {
  constructor (request = null) {
    this.Rqst = request;
    this.Srvc = { Rprt: {}, Sto: {}}; // service, report, data store.
  }

  /* do the 'task' function is on the browser environment.
    @ the task function will run on client (browser) side.
    < bool. */
  OnBrowser (task) {
    if (typeof process === 'object') { return false; }

    if (typeof task === 'function') { task(); }

    return true;
  }

  /* do the 'task' function if on the node environment.
    @ the task function will run on server (node) side.
    @ the request object in node.js, otherwise undefined. optional.
    < bool. */
  OnNode (task) {
    if (typeof process !== 'object') { return false; }

    if (typeof task === 'function') { task(this.Rqst); }

    return true;
  }

  /* get a store.
    @ a string of store key.
    < store object, or null. */
  StoreGet (key) {
    if (!key || typeof key !== 'string') { return null; }

    return this.Srvc.Sto[key] || null;
  }

  /* currently, this is only used by store.riot.
    @ name to locate the store.
    @ then(store, paramsToTask) = then, a function when the task done.
      @ the store object.
      @ params to task. to locate where the event comes from.
    @ run once in the beginning. */
  StoreListen (storeName, then, runOnce = true) {
    const callbacks = this.Srvc.Rprt[storeName] || null;

    if (!callbacks || !Array.isArray(callbacks)) {
      this.Srvc.Rprt[storeName] = [];
    }

    this.Srvc.Rprt[storeName].push(then);

    if (runOnce && this.Srvc.Sto[storeName]) { then(this.Srvc.Sto[storeName], null); } // if the task store is ready, call once first.
  }

  /* currently, this is only used by store.riot.
    @ store name.
    @ target report. */
  StoreUnleash (storeName, targetReport) {
    const report = this.Srvc.Rprt[storeName];

    if (!report) { return; }

    for (let i = 0; i < report.length; i++) {
      if (report[i] === targetReport) { this.Srvc.Rprt[storeName].splice(i, 1); }
    }
  }

  /*
    @ name to locate the store.
    @ newStoreGet(store, result) = the function to get new store, this must return something to replace original store.
      @ original store data.
      < new store object.
    @ params object passing to each task.
    < result code. 0 as fine, < 0 as error. */
  StoreSet (storeName, newStoreGet, paramsToTask) {
    if (!storeName || typeof storeName !== 'string' || !newStoreGet || typeof newStoreGet !== 'function') { return -1; }

    const report = this.Srvc.Rprt[storeName] || [];

    const length = report && Array.isArray(report) && report.length || 0;

    this.Srvc.Sto[storeName] = newStoreGet(this.Srvc.Sto[storeName]);

    for (let i = 0; i < length; i++) { report[i](this.Srvc.Sto[storeName], paramsToTask); }

    return 0;
  }

  /* the generated Riot code in browser will call this to initialize Riot-4-Fun Store.
    @ store json string. */
  StoreInject (storeString) {
    try {
      this.Srvc.Sto = JSON.parse(storeString);
    }
    catch (Err) {
      console.log(Err); // eslint-disable-line no-console
    }
  }

  /* print store as browser Js code to initialize Riot-4-Fun Store support in browser environment.
    this only works on node.js to generates HTML page source code. */
  StorePrint () {
    const stores = Object.entries(this.Srvc.Sto);

    if (this.Srvc.Sto.PAGE) {
      this.Srvc.Sto.PAGE = ''; // clean server only store - PAGE.
    }

    // no stores, or only PAGE store.
    if (stores.length === 0 || (stores === 1 && stores[0][1] === 'PAGE')) {
      return '';
    }

    return `
      <script id='riot-4-fun-store' type='application/json'>${JSON.stringify(this.Srvc.Sto)}</script>
      <script type='module'>
        window.riotPlugin.StoreInject(document.getElementById('riot-4-fun-store').textContent);
      </script>
    `;
  }

  /* a service which also take cover Store manage.
    @ URL string, the service entry point, or { Url, Mthd } object.
    @ params object to call service.
    @ name to locate the store.
    @ newStoreGet (store, result) = the function to get new store, this must return something to replace original store.
      @ original store data.
      @ result from API.
    @ params object passing to each task. optional.
    @ the service cases object in node.js, otherwise undefined. optional.
    < result code. */
  ServiceCall (url, params, storeName, newStoreGet, paramsToTask, ajxOptions) {
    let method = 'POST';

    if (typeof url === 'object' && url.Mthd) {
      method = url.Mthd;
      url = url.Url;
    }
    else if (typeof url !== 'string') {
      return -1;
    }

    if (!storeName || typeof storeName !== 'string' ||
        !newStoreGet || typeof newStoreGet !== 'function')
    { return -2; }

    const service = this.Srvc;

    ajax({
      ...ajxOptions,
      URL: url,
      Mthd: method,
      Data: params,
      Err: () => {
        console.log('---- AJAX query fail ----\nUrl: ' + url + '\nparams:'); // eslint-disable-line no-console
        console.log(params); // eslint-disable-line no-console
        console.log('----\n'); // eslint-disable-line no-console

        service.Sto[storeName] = newStoreGet(service.Sto[storeName], '');
      },
      OK: (responseText, status, xhr) => {
        const contentType = xhr.getResponseHeader('content-type');
        const report = service.Rprt[storeName] || [];
        let result = responseText;

        const length = report && Array.isArray(report) && report.length || 0;

        if (result && (contentType === 'application/json' || contentType === 'text/json')) {
          result = JSON.parse(result);
        }

        service.Sto[storeName] = newStoreGet(service.Sto[storeName], result);

        for (let i = 0; i < length; i++) { report[i](service.Sto[storeName], paramsToTask); }
      },
    });

    return 0;
  }

  Bind (component) {
    component.OnBrowser = this.OnBrowser;
    component.OnNode = (...values) => this.OnNode.apply(this, values);
    component.StoreGet = (...values) => this.StoreGet.apply(this, values);
    component.StoreListen = (...values) => this.StoreListen.apply(this, values); // currently, only Store.riot uses.
    component.StoreUnleash = (...values) => this.StoreUnleash.apply(this, values); // currently, only Store.riot uses.
    component.StoreSet = (...values) => this.StoreSet.apply(this, values);

    if (this.OnBrowser()) {
      component.ServiceCall = (...values) => this.ServiceCall.apply(this, values);
    }

    return component;
  }
}

export default Plugin;
