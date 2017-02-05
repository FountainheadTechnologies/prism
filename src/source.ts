import * as query from "./query";
import {Item, Collection} from "./types";

import * as Promise from "bluebird";

interface Source {
  create<R extends Item | Collection>(query: query.Create): Promise<R>;

  read<R extends Item | Collection>(query: query.Read): Promise<R>;

  update<R extends Item | Collection>(query: query.Update): Promise<R>;

  delete<T extends query.Delete>(query: T): Promise<Boolean>;
}

export default Source;
