/*
 *    Copyright 2019 Dgraph Labs, Inc. and Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package auth

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"testing"

	"github.com/dgraph-io/dgraph/graphql/authorization"
	"github.com/dgraph-io/dgraph/graphql/e2e/common"
	"github.com/dgraph-io/dgraph/testutil"
	"github.com/google/go-cmp/cmp"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

const (
	graphqlURL = "http://localhost:8180/graphql"
)

var (
	metainfo authorization.AuthMeta
)

type User struct {
	Username string
	Age      uint64
	IsPublic bool
	Disabled bool
}

type Region struct {
	Id    uint64
	Name  string
	Users []*User
}

type Movie struct {
	Id               uint64
	Content          string
	Disabled         bool
	RegionsAvailable []*Region
}

type Issue struct {
	Id    uint64
	Msg   string
	Owner *User
}

type Log struct {
	Id   uint64
	Logs string
}

type Role struct {
	Id         uint64
	Permission string
	AssignedTo []User
}

type Ticket struct {
	Id         uint64
	OnColumn   Column
	Title      string
	AssignedTo []User
}

type Column struct {
	ColID     string
	InProject Project
	Name      string
	Tickets   []Ticket
}

type Project struct {
	ProjID  uint64
	Name    string
	Roles   []Role
	Columns []Column
}

type TestCase struct {
	user   string
	role   string
	result string
	name   string
	filter map[string]interface{}
}

func getJWT(t *testing.T, user, role string) string {
	authMeta := testutil.AuthMeta{
		PublicKey: metainfo.PublicKey,
		Namespace: metainfo.Namespace,
		AuthVars: map[string]interface{}{
			"USER": user,
			"ROLE": role,
		},
	}
	jwtToken, err := authMeta.GetSignedToken()
	require.NoError(t, err)
	return jwtToken
}

func TestOrRBACFilter(t *testing.T) {
	t.Skip()
	testCases := []TestCase{}

	query := `
            query {
                queryProject (order: {asc: name}) {
			name
		}
	    }
	`

	for _, tcase := range testCases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers: map[string][]string{},
				Query:   query,
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func getColID(t *testing.T, tcase TestCase) string {
	query := `
		query($name: String!) {
		    queryColumn(filter: {name: {eq: $name}}) {
		        colID
		    	name
		    }
		}
	`

	var result struct {
		QueryColumn []*Column
	}

	getUserParams := &common.GraphQLParams{
		Headers:   map[string][]string{},
		Query:     query,
		Variables: map[string]interface{}{"name": tcase.name},
	}
	getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

	gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
	require.Nil(t, gqlResponse.Errors)

	err := json.Unmarshal([]byte(gqlResponse.Data), &result)
	require.Nil(t, err)

	if len(result.QueryColumn) > 0 {
		return result.QueryColumn[0].ColID
	}

	return ""
}

func TestRootGetFilter(t *testing.T) {
	idCol1 := getColID(t, TestCase{"user1", "USER", "", "Column1", nil})
	idCol2 := getColID(t, TestCase{"user2", "USER", "", "Column2", nil})

	require.NotEqual(t, idCol1, "")
	require.NotEqual(t, idCol2, "")

	tcases := []TestCase{{
		user:   "user1",
		role:   "USER",
		result: `{"getColumn": {"name": "Column1"}}`,
		name:   idCol1,
	}, {
		user:   "user1",
		role:   "USER",
		result: `{"getColumn": null}`,
		name:   idCol2,
	}, {
		user:   "user2",
		role:   "USER",
		result: `{"getColumn": {"name": "Column2"}}`,
		name:   idCol2,
	}}

	query := `
		query($id: ID!) {
		    getColumn(colID: $id) {
			name
		    }
		}
	`

	for _, tcase := range tcases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers:   map[string][]string{},
				Query:     query,
				Variables: map[string]interface{}{"id": tcase.name},
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func TestDeepFilter(t *testing.T) {
	tcases := []TestCase{{
		user:   "user1",
		role:   "USER",
		result: `{"queryProject":[{"name":"Project1","columns":[{"name":"Column1"}]}]}`,
		name:   "Column1",
	}, {
		user:   "user2",
		role:   "USER",
		result: `{"queryProject":[{"name":"Project1","columns":[{"name":"Column1"}]}, {"name":"Project2","columns":[]}]}`,
		name:   "Column1",
	}, {
		user:   "user2",
		role:   "USER",
		result: `{"queryProject":[{"name":"Project1","columns":[]}, {"name":"Project2","columns":[{"name":"Column3"}]}]}`,
		name:   "Column3",
	}}

	query := `
		query($name: String!) {
		    queryProject (order: {asc: name}) {
		       name
		       columns (filter: {name: {eq: $name}}, first: 1) {
		       	   name
                       }
                    }
                 }
	`

	for _, tcase := range tcases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers:   map[string][]string{},
				Query:     query,
				Variables: map[string]interface{}{"name": tcase.name},
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)
			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func TestRootFilter(t *testing.T) {
	testCases := []TestCase{{
		user:   "user1",
		role:   "USER",
		result: `{"queryColumn": [{"name": "Column1"}]}`,
	}, {
		user:   "user2",
		role:   "USER",
		result: `{"queryColumn": [{"name": "Column1"}, {"name": "Column2"}, {"name": "Column3"}]}`,
	}, {
		user:   "user4",
		role:   "USER",
		result: `{"queryColumn": [{"name": "Column2"}, {"name": "Column3"}]}`,
	}}
	query := `
	query {
		queryColumn(order: {asc: name}) {
			name
		}
	}
	`

	for _, tcase := range testCases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers: map[string][]string{},
				Query:   query,
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func TestRBACFilter(t *testing.T) {
	t.Skip()
	testCases := []TestCase{}
	query := `
		query {
                    queryLog (order: {asc: logs}) {
		    	logs
		    }
		}
	`

	for _, tcase := range testCases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers: map[string][]string{},
				Query:   query,
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func TestAndRBACFilter(t *testing.T) {
	t.Skip()
	testCases := []TestCase{}
	query := `
		query {
                    queryIssue (order: {asc: msg}) {
			msg
		    }
		}
	`

	for _, tcase := range testCases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers: map[string][]string{},
				Query:   query,
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}

}

func TestNestedFilter(t *testing.T) {
	testCases := []TestCase{{
		user: "user1",
		role: "USER",
		result: `
{
   "queryMovie": [
      {
         "content": "Movie2",
         "regionsAvailable": [
            {
               "name": "Region1"
            }
         ]
      },
      {
         "content": "Movie3",
         "regionsAvailable": [
            {
               "name": "Region1"
            },
            {
               "name": "Region4"
            }
         ]
      }
   ]
}
		`,
	}, {
		user: "user2",
		role: "USER",
		result: `
{
   "queryMovie": [
      {
         "content": "Movie1",
         "regionsAvailable": [
            {
               "name": "Region2"
            },
            {
               "name": "Region3"
            }
         ]
      },
      {
         "content": "Movie2",
         "regionsAvailable": [
            {
               "name": "Region1"
            }
         ]
      },
      {
         "content": "Movie3",
         "regionsAvailable": [
            {
               "name": "Region1"
            },
            {
               "name": "Region4"
            }
         ]
      }
   ]
}
		`,
	}}

	query := `
		query {
                    queryMovie (order: {asc: content}) {
		           content
		           regionsAvailable (order: {asc: name}) {
		           	name
		           }
		    }
		}
	`

	for _, tcase := range testCases {
		t.Run(tcase.role+tcase.user, func(t *testing.T) {
			getUserParams := &common.GraphQLParams{
				Headers: map[string][]string{},
				Query:   query,
			}
			getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

			gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
			require.Nil(t, gqlResponse.Errors)

			require.JSONEq(t, string(gqlResponse.Data), tcase.result)
		})
	}
}

func TestDeleteAuthRule(t *testing.T) {
	testCases := []TestCase{
		{
			name: "user with secret info",
			user: "user1",
			filter: map[string]interface{}{
				"aSecret": map[string]interface{}{
					"anyofterms": "Secret data",
				},
			},
			result: `{"deleteUserSecret":{"msg":"Deleted","numUids":1}}`,
		},
		{
			name: "user without secret info",
			user: "user2",
			filter: map[string]interface{}{
				"aSecret": map[string]interface{}{
					"anyofterms": "Sensitive information",
				},
			},
			result: `{"deleteUserSecret":{"msg":"Deleted","numUids":0}}`,
		},
	}
	query := `
		 mutation deleteUserSecret($filter: UserSecretFilter!){
		  deleteUserSecret(filter: $filter) {
			msg
			numUids
		  }
		}
	`

	for _, tcase := range testCases {
		getUserParams := &common.GraphQLParams{
			Headers: map[string][]string{},
			Query:   query,
			Variables: map[string]interface{}{
				"filter": tcase.filter,
			},
		}
		getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

		gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
		require.Nil(t, gqlResponse.Errors)

		if diff := cmp.Diff(tcase.result, string(gqlResponse.Data)); diff != "" {
			t.Errorf("result mismatch (-want +got):\n%s", diff)
		}
	}
}

func TestDeleteDeepAuthRule(t *testing.T) {
	testCases := []TestCase{
		{
			name: "ticket without edit permission",
			user: "user3",
			filter: map[string]interface{}{
				"title": map[string]interface{}{
					"anyofterms": "Ticket2",
				},
			},
			result: `{"deleteTicket":{"msg":"Deleted","numUids":0}}`,
		},
		{
			name: "ticket with edit permission",
			user: "user5",
			filter: map[string]interface{}{
				"title": map[string]interface{}{
					"anyofterms": "Ticket1",
				},
			},
			result: `{"deleteTicket":{"msg":"Deleted","numUids":1}}`,
		},
	}
	query := `
		mutation deleteTicket($filter: TicketFilter!) {
		  deleteTicket(filter: $filter) {
			msg
			numUids
		  }
		}
	`

	for _, tcase := range testCases {
		getUserParams := &common.GraphQLParams{
			Headers: map[string][]string{},
			Query:   query,
			Variables: map[string]interface{}{
				"filter": tcase.filter,
			},
		}
		getUserParams.Headers.Add(metainfo.Header, getJWT(t, tcase.user, tcase.role))

		gqlResponse := getUserParams.ExecuteAsPost(t, graphqlURL)
		require.Nil(t, gqlResponse.Errors)

		if diff := cmp.Diff(tcase.result, string(gqlResponse.Data)); diff != "" {
			t.Errorf("result mismatch (-want +got):\n%s", diff)
		}
	}
}

func TestMain(m *testing.M) {
	schemaFile := "schema.graphql"
	schema, err := ioutil.ReadFile(schemaFile)
	if err != nil {
		panic(err)
	}
	metainfo = authorization.Parse(string(schema))

	jsonFile := "test_data.json"
	data, err := ioutil.ReadFile(jsonFile)
	if err != nil {
		panic(errors.Wrapf(err, "Unable to read file %s.", jsonFile))
	}

	common.BootstrapServer(schema, data)

	os.Exit(m.Run())
}