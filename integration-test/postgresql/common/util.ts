import {omit} from 'ramda';
import _fetch from 'node-fetch';

export const getProperties = omit(['_links', '_forms', '_embedded']);

export const fetch = (url: string, options = {}) => {
  if (process.env.REQUEST_TOKEN) {
    options = {
      ...options,
      headers: {
        ...options['headers'],
        Authorization: `Bearer ${process.env.REQUEST_TOKEN}`
      }
    }
  }

  return _fetch(url, options);
}
