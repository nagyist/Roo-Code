# Parallelizability Analyzer Mode

The Parallelizability Analyzer mode is a specialized Roo mode that determines whether a group of GitHub issues can be worked on in parallel without conflicts. It analyzes dependencies, file overlaps, labels, and metadata to detect potential conflicts and provides recommendations for optimal parallel development strategies.

## Features

- **Multi-Input Support**: Accepts GitHub issue URLs, issue numbers, or search queries
- **Dependency Analysis**: Detects explicit and implicit dependencies between issues
- **File Overlap Detection**: Analyzes potential file conflicts using heuristics and static analysis
- **Risk Assessment**: Provides configurable risk scoring and confidence levels
- **Parallel Grouping**: Recommends optimal groupings for parallel development
- **Comprehensive Reporting**: Generates detailed reports in markdown and JSON formats
- **CLI Integration**: Exposes command-line interface for automation
- **API Support**: Provides structured JSON output for integration with other tools

## Quick Start

### Basic Usage

1. **Switch to the mode:**

    ```
    Switch to parallelizability-analyzer mode
    ```

2. **Analyze issues by URL:**

    ```
    Analyze these GitHub issues for parallelizability:
    - https://github.com/RooCodeInc/Roo-Code/issues/5648
    - https://github.com/RooCodeInc/Roo-Code/issues/5647
    - https://github.com/RooCodeInc/Roo-Code/issues/5646
    ```

3. **Analyze by issue numbers:**

    ```
    Analyze issues #5648, #5647, and #5646 for parallel development
    ```

4. **Analyze by search query:**
    ```
    Analyze all open issues labeled "enhancement" for parallelizability
    ```

### Configuration Options

The analyzer supports various configuration parameters:

- **Risk Tolerance**: `conservative`, `balanced`, `aggressive`
- **Confidence Threshold**: 0.0 to 1.0 (default: 0.7)
- **Max Group Size**: Maximum issues per parallel group (default: 5)
- **Analysis Depth**: `basic`, `standard`, `comprehensive`

## Analysis Workflow

The mode follows a 7-step analysis process:

1. **Initialization**: Parse input and validate GitHub access
2. **Data Collection**: Fetch issue details, labels, and metadata
3. **Dependency Analysis**: Detect explicit and implicit dependencies
4. **File Overlap Detection**: Analyze potential file conflicts
5. **Heuristic Analysis**: Apply scoring algorithms and risk assessment
6. **Report Generation**: Create comprehensive analysis reports
7. **Integration**: Provide recommendations and next steps

## Analysis Algorithms

### Dependency Detection

**Explicit Dependencies:**

- Issue references in descriptions (`#1234`, `fixes #1234`)
- Cross-repository references
- Pull request links
- Milestone relationships

**Implicit Dependencies:**

- Shared file patterns
- Related functionality areas
- Common labels and tags
- Architectural relationships

### File Overlap Analysis

**Direct Conflicts:**

- Exact file path matches in issue descriptions
- Modified files in linked pull requests

**Predicted Overlaps:**

- Configuration files (package.json, .roomodes)
- Shared modules and utilities
- Infrastructure and deployment files
- Documentation and README files

### Scoring Algorithm

The parallelizability score is calculated using weighted factors:

```
Score = (1 - dependency_weight * dependency_score) *
        (1 - overlap_weight * file_overlap_score) *
        (1 - complexity_weight * complexity_score) *
        confidence_multiplier
```

Default weights:

- Dependency: 0.4
- File Overlap: 0.3
- Complexity: 0.2
- Risk Tolerance: 0.1

## Output Formats

### Markdown Report

Comprehensive human-readable report including:

- Executive summary with overall assessment
- Detailed issue analysis
- Dependency mapping
- File overlap analysis
- Risk assessment
- Parallel group recommendations
- Coordination strategies

### JSON API Response

Structured data format for programmatic consumption:

- Overall assessment scores
- Parallel group definitions
- Pairwise conflict analysis
- Risk factors and mitigations
- Coordination requirements
- Success metrics

## Common Use Cases

### Sprint Planning

```
Analyze all issues in the current milestone for optimal sprint planning
```

### Release Preparation

```
Analyze release-critical issues to identify parallel development opportunities
```

### Technical Debt Cleanup

```
Analyze technical debt issues to group related refactoring work
```

### Feature Development

```
Analyze feature requests to identify dependencies and coordination needs
```

## Integration Examples

### Task Management Integration

The analyzer can integrate with various task management systems:

- **Jira**: Export parallel groups as epics with coordinated stories
- **Azure DevOps**: Create work item hierarchies based on analysis
- **GitHub Projects**: Organize issues into parallel development columns
- **Trello**: Create boards with coordinated development lanes

### CI/CD Integration

```bash
# Example webhook integration
curl -X POST /api/parallelizability/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "issues": ["#1234", "#1235", "#1236"],
    "config": {
      "risk_tolerance": "balanced",
      "confidence_threshold": 0.7
    }
  }'
```

### Parallel Worker Coordination

The analyzer provides input for parallel worker systems:

```json
{
	"parallel_groups": [
		{
			"group_id": 1,
			"issues": [1234, 1235],
			"coordination_requirements": ["shared_config_sync"],
			"estimated_duration": "3-5 days"
		}
	]
}
```

## Best Practices

### Input Preparation

- Ensure issues have detailed descriptions
- Use consistent labeling across issues
- Include file paths in issue descriptions when known
- Link related issues explicitly

### Analysis Configuration

- Start with balanced risk tolerance for most scenarios
- Use conservative settings for critical releases
- Adjust confidence thresholds based on team experience
- Consider team size when setting max group sizes

### Result Interpretation

- Review dependency analysis for accuracy
- Validate file overlap predictions with domain knowledge
- Consider team expertise when forming parallel groups
- Plan integration points early in development

### Coordination Strategies

- Establish communication channels for each parallel group
- Create shared documentation for overlapping areas
- Plan regular sync meetings for medium/high risk groups
- Use feature branches to isolate parallel development

## Troubleshooting

### Common Issues

**GitHub API Rate Limits:**

- Use authenticated requests with higher rate limits
- Implement request batching for large issue sets
- Cache issue data for repeated analyses

**Inaccurate Dependency Detection:**

- Improve issue descriptions with explicit references
- Use consistent naming conventions across issues
- Manually specify dependencies when automatic detection fails

**File Overlap False Positives:**

- Refine file pattern matching rules
- Use project-specific configuration files
- Manually review and adjust overlap predictions

### Performance Optimization

- Limit analysis to relevant issue subsets
- Use cached data for repeated analyses
- Implement parallel processing for large issue sets
- Configure appropriate timeout values

## Configuration Reference

### Risk Tolerance Levels

**Conservative:**

- Lower parallelizability scores
- Higher coordination requirements
- Emphasis on conflict prevention

**Balanced:**

- Moderate risk acceptance
- Balanced speed vs. safety
- Recommended for most scenarios

**Aggressive:**

- Higher parallelizability scores
- Minimal coordination overhead
- Suitable for experienced teams

### Confidence Thresholds

- **0.9+**: High confidence, minimal false positives
- **0.7-0.9**: Balanced confidence, good for most use cases
- **0.5-0.7**: Lower confidence, more permissive grouping
- **<0.5**: Experimental, high false positive rate

## API Reference

### Core Commands

```bash
# Analyze specific issues
roo analyze-parallelizability --issues "#1234,#1235,#1236"

# Analyze by query
roo analyze-parallelizability --query "label:enhancement state:open"

# Configure analysis
roo analyze-parallelizability --config risk_tolerance=conservative

# Output formats
roo analyze-parallelizability --format json --output results.json
```

### Configuration Files

Create `.parallelizability-config.json` in your project root:

```json
{
	"risk_tolerance": "balanced",
	"confidence_threshold": 0.7,
	"max_group_size": 5,
	"file_patterns": {
		"config": ["package.json", ".roomodes", "*.config.js"],
		"infrastructure": ["Dockerfile", "docker-compose.yml", "*.tf"],
		"documentation": ["README.md", "docs/**/*.md"]
	},
	"weights": {
		"dependency": 0.4,
		"file_overlap": 0.3,
		"complexity": 0.2,
		"risk_tolerance": 0.1
	}
}
```

## Contributing

To extend the parallelizability analyzer:

1. **Add new heuristics** in [`2_analysis_algorithms.xml`](.roo/rules-parallelizability-analyzer/2_analysis_algorithms.xml:1)
2. **Extend CLI interface** in [`3_cli_and_integration.xml`](.roo/rules-parallelizability-analyzer/3_cli_and_integration.xml:1)
3. **Add usage examples** in [`4_usage_examples.xml`](.roo/rules-parallelizability-analyzer/4_usage_examples.xml:1)
4. **Update workflow** in [`1_workflow.xml`](.roo/rules-parallelizability-analyzer/1_workflow.xml:1)

## License

This mode is part of the Roo Code project and follows the same licensing terms.
