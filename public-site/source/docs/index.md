# Documentation

This Documentation gets you introduced to Prism, the reasoning behind its design, and the concepts you'll need to build awesome APIs.

Throughout this guide, we assume that you have at least a working knowledge of the following topics:

- Programming NodeJS applications in JavaScript, and the new syntax features present in ES6.
- Building an HTTP API that exposes 'plain' JSON.
- HTTP terminology as as request methods, content types and response codes.

If at any time you encounter an issue or have a question that is not answered by this documentation, you are welcome to:

- Raise an Issue on our tracker
- Post a question to StackOverflow
- Submit a message to the Prism Google Group

## What is Prism?

Prism was borne out of writing repetetive code on a multitude of projects which all shared a common trait: some kind of API, exposing various database objects, with Hypermedia features such as linked data, embedded data and self documentation.

Prism a Framework for building Hypermedia HTTP APIs that interact with some form of database. You create 'Actions' such a Create, Read, Update and Delete, that are bound to a data source such as a table in a database. The configuration of each Action and Data Source dictates semantics such as the URL, request method and response format that the Action will adhere to.

Prism ships with the components necessary to create an API that is bound to a PostgreSQL database. Data sources for MySQL, MongoDB and other databases will be available soon as addons.

## Why use Prism?

If you find yourself frequently writing a large volume of boilerplate code, just to connect a database to an HTTP API, chances are you'll benefit from using Prism instead.

If you're planning or (struggling to) implement an API with impressive Hypermedia features such as linked/embedded data and schema-driven forms, than we're certain the Prism is an ideal fit.

Finally, Prism integrates perfectly with its sister projects Collimator and Lens, allowing you to make your database schema the canonical source of truth -- no more defining the 'shape' of your data in three different places with three different languages!
