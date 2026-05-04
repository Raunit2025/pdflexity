package model

// Command is the JSON-RPC request read from stdin.
// One JSON object per line — never batched.
type Command struct {
	Op          string   `json:"op"`
	InputPath   string   `json:"inputPath"`
	InputPathB  string   `json:"inputPathB,omitempty"`  // compare: second input
	InputPaths  []string `json:"inputPaths,omitempty"`  // merge: multiple inputs
	OutputPath  string   `json:"outputPath"` // or OutputDir for split
	Password    string   `json:"password,omitempty"`
	
	// Split operations
	PageRanges  []string `json:"pageRanges,omitempty"`  // e.g., ["1-3", "5"]
	MergeOutput bool     `json:"mergeOutput,omitempty"` // true = trim to single file

}

// Response is the JSON-RPC result written to stdout.
type Response struct {
	Success    bool   `json:"success"`
	OutputPath string `json:"outputPath,omitempty"`
	Error      string `json:"error,omitempty"`
}
