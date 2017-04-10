import { CreateToken } from "../CreateToken";
import { backend } from "../__mocks__/backend";
import { request } from "../../action/__mocks__/hapi";
import { Registry } from "../../Registry";
import { Root } from "../../action/Root";
import { Document } from "../../Document";

let createToken: CreateToken;

beforeEach(() => {
  createToken = new CreateToken(backend, {
    key: "testPrivateKey",
    sign: {}
  });
});

it("is a POST request to `token` that does not require auth", () => {
  expect(createToken.method).toBe("POST");
  expect(createToken.path).toBe("token");
  expect(createToken.routeConfig).toEqual({
    auth: false
  });
});

describe("#handle()", () => {
  let issueResponse: any;

  beforeEach(() => {
    (backend.issue as jest.Mock<any>).mockImplementation(() => Promise.resolve(issueResponse));
  });

  it("signs result of `backend.issue()` and sets to value of `token`", async () => {
    issueResponse = "validToken";

    let response = await createToken.handle({}, request);
    expect(response.code).toHaveBeenCalledWith(201);
    expect((request as any).generateResponse).toHaveBeenLastCalledWith({
      token: "eyJhbGciOiJIUzI1NiJ9.dmFsaWRUb2tlbg.NPccG0bOa7uV0HHGuPt04Rt1O3aOIsifqgkyHRpX3pQ"
    });
  });

  describe("when `backend.issue()` resolves to `false`", () => {
    it("generates a 403 response", async () => {
      issueResponse = false;
      let response = await createToken.handle({}, request);
      expect(response.code).toHaveBeenCalledWith(403);
    });
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();

    registry.registerObject(root);
    registry.registerObject(createToken);
    registry.applyFilters();
  });

  it("adds a form to itself to the Root action that is only visible to non-authenticated users", async () => {
    let document = new Document();
    await root.decorate(document, {}, request);

    expect(document.forms).toContainEqual({
      rel: "token",
      name: "create",
      href: "token",
      method: "POST",
      schema: backend.schema,
      public: true,
      private: false
    });
  });

  it("adds a form to itself to the Root action that is only visible to authenticated users", async () => {
    let document = new Document();
    await root.decorate(document, {}, request);

    expect(document.forms).toContainEqual({
      rel: "token",
      name: "refresh",
      href: "token",
      method: "POST",
      schema: backend.schema
    });
  });
});
