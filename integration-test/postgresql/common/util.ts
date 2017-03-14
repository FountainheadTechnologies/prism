import {omit} from 'ramda';

export const getProperties = omit(['_links', '_forms', '_embedded']);
