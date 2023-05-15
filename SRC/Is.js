export const Is = {
  Boolean: function (Obj) { return (typeof Obj === 'boolean'); },
  Number: function (Obj) { return (typeof Obj === 'number'); },
  String: function (Obj) { return (typeof Obj === 'string'); },
  Function: function (Obj) { return (typeof Obj === 'function'); },
  Object: function (Obj) { return (typeof Obj === 'object'); },
  Undefined: function (Obj) { return (typeof Obj === 'undefined'); },
  Array: function (Obj) { return Array.isArray(Obj); },
  Date: function (Obj) { return (Obj instanceof Date); },
  RegExp: function (Obj) { return (Obj instanceof RegExp); },
  Promise: function (Obj) {
    // return (typeof Obj !== 'object' || !Obj.hasOwnProperty('then') || !Obj.hasOwnProperty('catch'));
    return (
      typeof Obj !== 'object' ||
      !Object.prototype.hasOwnProperty.call(Obj, 'then') ||
      !Object.prototype.hasOwnProperty.call(Obj, 'catch')
    );
  },
  EMail: function (Str) {
    if (typeof Str !== 'string') { return false; }

    return (/^[\w.]+@.{2,16}\.[0-9a-z]{2,3}$/).test(Str);
  },
  jQuery: function (Obj) { return (typeof jQuery !== 'undefined' && Obj instanceof jQuery); },
  URL: function (Obj) {
    if (typeof Obj !== 'string') { return false; }

    return (/(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/).test(Obj);
  }, // from here : https://stackoverflow.com/questions/1701898/how-to-detect-whether-a-string-is-in-url-format-using-javascript
  UUID: function (Obj) {
    if (typeof Obj !== 'string') { return false; }

    return (
        Obj.match(/^[0-9a-fA-F]{32}$/) ||
        Obj.match(/^[0-9a-fA-F]{13}$/) ||
        Obj.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) ||
        Obj.match(/^[0-9a-fA-F]{22}$/)) ? true : false;
  },
  ArrayEqual: function (A, B) {
    if (!Array.isArray(A) || !Array.isArray(B)) { false; }

    if (A === B) { return true; }

    if (A.length !== B.length) { return false; }

    for (let i = 0; i < A.length; i++) {
      if (A[i] !== B[i]) { return false; }
    }

    return true;
  },
  /* test if a string is a TimeStamp (YYYY-MM-DD HH:II:SS).
    @ time string.
    < true | false. */
  TimeStamp: function (TmStr) {
    if (typeof TmStr !== 'string' || TmStr.length === 0) { return false; }

    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(TmStr);
  }
};

export default Is;
