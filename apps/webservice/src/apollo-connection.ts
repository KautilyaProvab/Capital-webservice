import ApolloClient, { gql, InMemoryCache } from "apollo-boost";
import fetcher from "isomorphic-fetch";
import * as omitDeep from "omit-deep";

const client = new ApolloClient({
    uri: "http://localhost:6014/graphql",
    fetchOptions: { fetch: fetcher },
    cache: new InMemoryCache()
});
client.defaultOptions = {
    watchQuery: {
        fetchPolicy: "no-cache",
        errorPolicy: "ignore"
    },
    query: {
        fetchPolicy: "no-cache",
        errorPolicy: "all"
    }
};

export { gql, client };
export { omitDeep };
