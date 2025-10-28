package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/inngest/inngestgo"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		panic(err)
	}

	client, err := inngestgo.NewClient(inngestgo.ClientOpts{
		AppID: "sandbox-go",
	})
	if err != nil {
		panic(err)
	}

	_, err = inngestgo.CreateFunction(
		client,
		inngestgo.FunctionOpts{
			ID: "fn-1",
		},
		inngestgo.EventTrigger("event-1", nil),
		func(
			ctx context.Context,
			input inngestgo.Input[map[string]any],
		) (any, error) {
			return "Hello", nil
		},
	)
	if err != nil {
		panic(err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3939"
	}
	fmt.Println("Running on Port: ", port)

	http.ListenAndServe(fmt.Sprintf(":%s", port), client.Serve())
}
