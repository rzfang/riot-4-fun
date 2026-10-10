export function doSomething (request, response, params, end) {
  end(0, { meesage: 'doSomething is end.' });
}

export function doAnother (request, response, params, end) {
  end(0, { meesage: 'doAnother is end.' });
}

export function pureHttpHandle (request, response, then) {
  then();
}

export default {
  doSomething,
  doAnother,
  pureHttpHandle,
};
