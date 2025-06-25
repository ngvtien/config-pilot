## 🎯 **Updated Features:**

### 1. **FluentAssertions Integration**
- **Before**: `Assert.NotNull()` and `Assert.Empty()`
- **After**: `Should().NotBeNull()` and `Should().BeEmpty()`
- More readable and expressive assertions

### 2. **Bogus AutoFaker Integration**
- **Before**: Manual object creation with explicit null assignments
- **After**: Sophisticated test data generation with ignored collection properties

### 3. **Cleaner Test Setup**
```csharp
// Instead of this:
var customerdto = new CustomerDto();
customerdto.Tags = null;
customerdto.Categories = null;
customerdto.Addresses = null;

// We now generate this:
var customerdto = new AutoFaker<CustomerDto>()
            .Ignore(x => x.Tags)
            .Ignore(x => x.Categories)
            .Ignore(x => x.Addresses)
            .Generate();
```

## 🚀 **Benefits:**

### **FluentAssertions Benefits:**
- **Better Readability**: `collection.Should().BeEmpty()` reads like natural language
- **Better Error Messages**: More descriptive failure messages
- **Chainable**: Can chain multiple assertions together
- **IntelliSense Friendly**: Better IDE support

### **Bogus AutoFaker Benefits:**
- **Real Test Data**: Generates realistic data for non-ignored properties
- **Maintainable**: No need to manually update test setup when adding new properties
- **Flexible**: Can easily customize data generation rules
- **Professional**: Industry-standard approach for test data generation

## 📦 **Required Dependencies:**
```xml
<PackageReference Include="FluentAssertions" Version="6.12.0" />
<PackageReference Include="Bogus" Version="34.0.2" />
```

## 🔍 **What the Tests Verify:**
1. **Realistic Scenarios**: Objects have real data in non-collection properties
2. **Null Collections**: Collection properties are ignored (set to null by default)
3. **Mapping Behavior**: Your `MapTo{TargetTypeName}` methods handle nulls correctly
4. **Empty Collections**: Result collections are not null and are empty

---

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;

[Generator]
public class CollectionNullSafetyGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // Find all classes with DataContract attribute
        var dataContractClasses = context.SyntaxProvider
            .CreateSyntaxProvider(
                predicate: static (s, _) => IsClassWithDataContract(s),
                transform: static (ctx, _) => GetClassInfo(ctx))
            .Where(static m => m is not null);

        // Find all regular model classes (not DataContract)
        var modelClasses = context.SyntaxProvider
            .CreateSyntaxProvider(
                predicate: static (s, _) => IsModelClass(s),
                transform: static (ctx, _) => GetClassInfo(ctx))
            .Where(static m => m is not null);

        // Combine both collections
        var allClasses = dataContractClasses.Collect()
            .Combine(modelClasses.Collect())
            .Select(static (pair, _) => pair.Left.Concat(pair.Right).ToImmutableArray());

        // Generate test code
        context.RegisterSourceOutput(allClasses, static (spc, classes) => GenerateTests(spc, classes));
    }

    private static bool IsClassWithDataContract(SyntaxNode node)
    {
        return node is ClassDeclarationSyntax classDecl &&
               classDecl.AttributeLists.Any(al => al.Attributes.Any(a => 
                   a.Name.ToString().Contains("DataContract")));
    }

    private static bool IsModelClass(SyntaxNode node)
    {
        if (node is not ClassDeclarationSyntax classDecl)
            return false;

        // Check if it's a model class (ends with "Model" or has collection properties)
        var className = classDecl.Identifier.ValueText;
        return className.EndsWith("Model") || 
               classDecl.Members.OfType<PropertyDeclarationSyntax>()
                   .Any(p => IsCollectionProperty(p));
    }

    private static ClassInfo? GetClassInfo(GeneratorSyntaxContext context)
    {
        var classDecl = (ClassDeclarationSyntax)context.Node;
        var semanticModel = context.SemanticModel;
        
        var symbol = semanticModel.GetDeclaredSymbol(classDecl);
        if (symbol == null) return null;

        var collectionProperties = classDecl.Members
            .OfType<PropertyDeclarationSyntax>()
            .Where(IsCollectionProperty)
            .Select(p => new PropertyInfo(
                p.Identifier.ValueText,
                p.Type.ToString(),
                GetCollectionElementType(p.Type.ToString())))
            .ToList();

        if (!collectionProperties.Any()) return null;

        var isDataContract = classDecl.AttributeLists
            .Any(al => al.Attributes.Any(a => a.Name.ToString().Contains("DataContract")));

        return new ClassInfo(
            symbol.Name,
            symbol.ContainingNamespace.ToDisplayString(),
            isDataContract,
            collectionProperties);
    }

    private static bool IsCollectionProperty(PropertyDeclarationSyntax property)
    {
        var typeText = property.Type.ToString();
        return typeText.Contains("Array") ||
               typeText.Contains("Collection<") ||
               typeText.Contains("List<") ||
               typeText.Contains("ICollection<") ||
               typeText.Contains("IList<") ||
               typeText.Contains("IEnumerable<") ||
               typeText.EndsWith("[]");
    }

    private static string GetCollectionElementType(string typeText)
    {
        if (typeText.EndsWith("[]"))
            return typeText.Substring(0, typeText.Length - 2);
        
        var startIndex = typeText.IndexOf('<');
        var endIndex = typeText.LastIndexOf('>');
        
        if (startIndex > 0 && endIndex > startIndex)
            return typeText.Substring(startIndex + 1, endIndex - startIndex - 1);
        
        return "object";
    }

    private static void GenerateTests(SourceProductionContext context, ImmutableArray<ClassInfo> classes)
    {
        if (!classes.Any()) return;

        var sb = new StringBuilder();
        
        // Generate using statements
        sb.AppendLine("using System;");
        sb.AppendLine("using System.Collections.Generic;");
        sb.AppendLine("using System.Linq;");
        sb.AppendLine("using Xunit;");
        sb.AppendLine("using FluentAssertions;");
        sb.AppendLine("using Bogus;");
        sb.AppendLine("using System.Runtime.Serialization;");
        sb.AppendLine();

        // Group classes by namespace
        var namespaceGroups = classes.GroupBy(c => c.Namespace);

        foreach (var namespaceGroup in namespaceGroups)
        {
            sb.AppendLine($"namespace {namespaceGroup.Key}.Tests");
            sb.AppendLine("{");

            // Find DTO and Model pairs
            var dtos = namespaceGroup.Where(c => c.IsDataContract).ToList();
            var models = namespaceGroup.Where(c => !c.IsDataContract).ToList();

            foreach (var dto in dtos)
            {
                var correspondingModel = models.FirstOrDefault(m => 
                    m.Name.Replace("Model", "") == dto.Name.Replace("Dto", "").Replace("DTO", "") ||
                    m.Name == dto.Name.Replace("Dto", "Model").Replace("DTO", "Model"));

                if (correspondingModel != null)
                {
                    GenerateTestClass(sb, dto, correspondingModel);
                }
            }

            sb.AppendLine("}");
        }

        context.AddSource("CollectionNullSafetyTests.g.cs", sb.ToString());
    }

    private static void GenerateTestClass(StringBuilder sb, ClassInfo dto, ClassInfo model)
    {
        var testClassName = $"{dto.Name}To{model.Name}CollectionTests";
        
        sb.AppendLine($"    public class {testClassName}");
        sb.AppendLine("    {");

        // Generate test for DTO to Model conversion
        GenerateDtoToModelTest(sb, dto, model);
        
        // Generate test for Model to DTO conversion
        GenerateModelToDtoTest(sb, dto, model);

        sb.AppendLine("    }");
        sb.AppendLine();
    }

    private static void GenerateDtoToModelTest(StringBuilder sb, ClassInfo dto, ClassInfo model)
    {
        sb.AppendLine($"        [Fact]");
        sb.AppendLine($"        public void {dto.Name}_MapTo{model.Name}_NullCollections_ShouldReturnEmptyCollections()");
        sb.AppendLine("        {");
        sb.AppendLine("            // Arrange");
        sb.Append($"            var {dto.Name.ToLower()} = new AutoFaker<{dto.Name}>()");
        
        // Add Ignore calls for each collection property
        foreach (var prop in dto.CollectionProperties)
        {
            sb.AppendLine();
            sb.Append($"                        .Ignore(x => x.{prop.Name})");
        }
        sb.AppendLine();
        sb.AppendLine("                        .Generate();");
        
        sb.AppendLine();
        sb.AppendLine("            // Act");
        sb.AppendLine($"            var {model.Name.ToLower()} = {dto.Name.ToLower()}.MapTo{model.Name}();");
        sb.AppendLine();
        sb.AppendLine("            // Assert");
        
        foreach (var prop in dto.CollectionProperties)
        {
            var correspondingModelProp = model.CollectionProperties.FirstOrDefault(p => p.Name == prop.Name);
            if (correspondingModelProp != null)
            {
                sb.AppendLine($"            {model.Name.ToLower()}.{prop.Name}.Should().NotBeNull();");
                sb.AppendLine($"            {model.Name.ToLower()}.{prop.Name}.Should().BeEmpty();");
            }
        }
        
        sb.AppendLine("        }");
        sb.AppendLine();
    }

    private static void GenerateModelToDtoTest(StringBuilder sb, ClassInfo dto, ClassInfo model)
    {
        sb.AppendLine($"        [Fact]");
        sb.AppendLine($"        public void {model.Name}_MapTo{dto.Name}_NullCollections_ShouldReturnEmptyCollections()");
        sb.AppendLine("        {");
        sb.AppendLine("            // Arrange");
        sb.Append($"            var {model.Name.ToLower()} = new AutoFaker<{model.Name}>()");
        
        // Add Ignore calls for each collection property
        foreach (var prop in model.CollectionProperties)
        {
            sb.AppendLine();
            sb.Append($"                        .Ignore(x => x.{prop.Name})");
        }
        sb.AppendLine();
        sb.AppendLine("                        .Generate();");
        
        sb.AppendLine();
        sb.AppendLine("            // Act");
        sb.AppendLine($"            var {dto.Name.ToLower()} = {model.Name.ToLower()}.MapTo{dto.Name}();");
        sb.AppendLine();
        sb.AppendLine("            // Assert");
        
        foreach (var prop in model.CollectionProperties)
        {
            var correspondingDtoProp = dto.CollectionProperties.FirstOrDefault(p => p.Name == prop.Name);
            if (correspondingDtoProp != null)
            {
                sb.AppendLine($"            {dto.Name.ToLower()}.{prop.Name}.Should().NotBeNull();");
                sb.AppendLine($"            {dto.Name.ToLower()}.{prop.Name}.Should().BeEmpty();");
            }
        }
        
        sb.AppendLine("        }");
        sb.AppendLine();
    }

    private static string GetCollectionInitializer(string type)
    {
        if (type.Contains("Array") || type.EndsWith("[]"))
            return $"Array.Empty<{type.Replace("[]", "")}>()";
        
        if (type.Contains("List<"))
            return $"new {type}()";
            
        if (type.Contains("Collection<"))
            return $"new {type}()";
            
        if (type.Contains("ICollection<") || type.Contains("IList<") || type.Contains("IEnumerable<"))
        {
            var elementType = type.Substring(type.IndexOf('<') + 1, type.LastIndexOf('>') - type.IndexOf('<') - 1);
            return $"new List<{elementType}>()";
        }
        
        return "new List<object>()";
    }

    private record ClassInfo(
        string Name,
        string Namespace,
        bool IsDataContract,
        List<PropertyInfo> CollectionProperties);

    private record PropertyInfo(
        string Name,
        string Type,
        string ElementType);
}
```

---

## By CompileProvider

I'll help you modify the original code to use `CompilationProvider` to find `DataContract` classes from referenced assemblies while keeping the existing functionality for local model classes. Here's the complete solution:

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;

[Generator]
public class CollectionNullSafetyGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // Get the compilation provider
        var compilationProvider = context.CompilationProvider;
        
        // Find DataContract classes from all referenced assemblies
        var referencedDataContractClasses = compilationProvider.Select(
            static (compilation, _) => GetDataContractClassesFromCompilation(compilation));

        // Find all regular model classes (not DataContract) from current project
        var modelClasses = context.SyntaxProvider
            .CreateSyntaxProvider(
                predicate: static (s, _) => IsModelClass(s),
                transform: static (ctx, _) => GetClassInfo(ctx))
            .Where(static m => m is not null);

        // Combine both collections
        var allClasses = referencedDataContractClasses
            .Combine(modelClasses.Collect())
            .Select(static (pair, _) => pair.Left.Concat(pair.Right).ToImmutableArray());

        // Generate test code
        context.RegisterSourceOutput(allClasses, static (spc, classes) => GenerateTests(spc, classes));
    }

    private static ImmutableArray<ClassInfo> GetDataContractClassesFromCompilation(Compilation compilation)
    {
        var dataContractAttribute = compilation.GetTypeByMetadataName("System.Runtime.Serialization.DataContractAttribute");
        if (dataContractAttribute is null)
            return ImmutableArray<ClassInfo>.Empty;

        var result = new List<ClassInfo>();
        
        foreach (var assembly in compilation.SourceModule.ReferencedAssemblySymbols)
        {
            foreach (var type in GetAllTypes(assembly))
            {
                if (type.DeclaringSyntaxReferences.Length == 0 && // Only from metadata (not source)
                    type.GetAttributes().Any(ad => 
                        SymbolEqualityComparer.Default.Equals(ad.AttributeClass, dataContractAttribute)))
                {
                    var collectionProperties = GetCollectionPropertiesFromSymbol(type);
                    if (collectionProperties.Count > 0)
                    {
                        result.Add(new ClassInfo(
                            type.Name,
                            type.ContainingNamespace.ToDisplayString(),
                            true,
                            collectionProperties));
                    }
                }
            }
        }
        
        return result.ToImmutableArray();
    }

    private static List<PropertyInfo> GetCollectionPropertiesFromSymbol(INamedTypeSymbol type)
    {
        var properties = new List<PropertyInfo>();
        
        foreach (var member in type.GetMembers())
        {
            if (member is IPropertySymbol property && 
                IsCollectionType(property.Type))
            {
                properties.Add(new PropertyInfo(
                    property.Name,
                    property.Type.ToDisplayString(),
                    GetCollectionElementType(property.Type)));
            }
        }
        
        return properties;
    }

    private static bool IsCollectionType(ITypeSymbol typeSymbol)
    {
        var typeName = typeSymbol.ToDisplayString();
        
        if (typeName.EndsWith("[]"))
            return true;
            
        if (typeSymbol is INamedTypeSymbol namedType && 
            namedType.IsGenericType &&
            namedType.TypeArguments.Length == 1)
        {
            var fullName = namedType.ConstructedFrom?.ToDisplayString() ?? "";
            return fullName.Contains("Collection<") ||
                   fullName.Contains("List<") ||
                   fullName.Contains("ICollection<") ||
                   fullName.Contains("IList<") ||
                   fullName.Contains("IEnumerable<");
        }
        
        return false;
    }

    private static string GetCollectionElementType(ITypeSymbol typeSymbol)
    {
        if (typeSymbol is IArrayTypeSymbol arrayType)
            return arrayType.ElementType.ToDisplayString();
            
        if (typeSymbol is INamedTypeSymbol namedType && 
            namedType.IsGenericType &&
            namedType.TypeArguments.Length == 1)
        {
            return namedType.TypeArguments[0].ToDisplayString();
        }
        
        return "object";
    }

    // All the remaining methods stay exactly the same as in your original code:
    // IsModelClass, GetClassInfo, IsCollectionProperty, GenerateTests, 
    // GenerateTestClass, GenerateDtoToModelTest, GenerateModelToDtoTest,
    // GetCollectionInitializer, and the record definitions
    // ...
    // [Rest of your original code remains unchanged]
}
```

### Key Changes Made:

1. **Added Compilation Analysis**:
   - Created `GetDataContractClassesFromCompilation` to find `DataContract` classes in referenced assemblies
   - Uses `CompilationProvider` to get access to all referenced types

2. **Symbol-Based Property Analysis**:
   - Added `GetCollectionPropertiesFromSymbol` to analyze properties from metadata
   - Added `IsCollectionType` and `GetCollectionElementType` that work with symbols instead of syntax

3. **Combined Approach**:
   - Keeps the original syntax-based analysis for local model classes
   - Adds compilation-based analysis for external `DataContract` classes
   - Merges both results for test generation

4. **Filtering**:
   - Only processes types from metadata (`DeclaringSyntaxReferences.Length == 0`)
   - Only includes types that actually have collection properties

### Benefits of This Approach:

1. **Works with Referenced Assemblies**: Can now find `DataContract` classes even if they're not in source code
2. **Maintains Existing Functionality**: Still processes local model classes the same way
3. **More Accurate Type Analysis**: Uses Roslyn symbols for more reliable type information
4. **Better Performance**: Only processes types that actually have the `DataContract` attribute

The rest of your original code (test generation, etc.) can remain exactly the same since we're still producing the same `ClassInfo` records, just getting them from a different source.

---

Here's the implementation of the `GetAllTypes` helper method that recursively gets all types from an assembly symbol, including nested types:

```csharp
private static IEnumerable<INamedTypeSymbol> GetAllTypes(IAssemblySymbol assembly)
{
    var stack = new Stack<INamedTypeSymbol>();
    
    // Push all top-level types from all modules in the assembly
    foreach (var module in assembly.Modules)
    {
        foreach (var type in module.GlobalNamespace.GetTypeMembers())
        {
            stack.Push(type);
        }
        
        // Also process all namespaces recursively
        foreach (var namespaceMember in module.GlobalNamespace.GetNamespaceMembers())
        {
            ProcessNamespace(namespaceMember, stack);
        }
    }

    while (stack.Count > 0)
    {
        var type = stack.Pop();
        yield return type;

        // Push all nested types to be processed
        foreach (var nestedType in type.GetTypeMembers())
        {
            stack.Push(nestedType);
        }
    }
}

private static void ProcessNamespace(INamespaceSymbol namespaceSymbol, Stack<INamedTypeSymbol> stack)
{
    // Add all types in this namespace
    foreach (var type in namespaceSymbol.GetTypeMembers())
    {
        stack.Push(type);
    }

    // Recursively process child namespaces
    foreach (var childNamespace in namespaceSymbol.GetNamespaceMembers())
    {
        ProcessNamespace(childNamespace, stack);
    }
}
```

### Key Features:

1. **Recursive Processing**:
   - Handles nested types (types within types)
   - Processes all namespaces recursively

2. **Stack-Based Approach**:
   - Uses a stack to avoid recursion depth limitations
   - More efficient than pure recursive methods for deep type hierarchies

3. **Complete Coverage**:
   - Gets all types from all modules in the assembly
   - Includes types from all namespaces

4. **Roslyn-Specific**:
   - Works with `INamedTypeSymbol` from the Roslyn API
   - Compatible with source generator context

### Usage Example:

```csharp
foreach (var assembly in compilation.SourceModule.ReferencedAssemblySymbols)
{
    foreach (var type in GetAllTypes(assembly))
    {
        // Process each type
        if (type.GetAttributes().Any(/* your condition */))
        {
            // Do something with matching types
        }
    }
}
```

### Performance Considerations:

1. **Lazy Evaluation**: The method uses `yield return` for lazy evaluation
2. **Minimal Allocation**: Only allocates a stack for processing
3. **Early Exit**: You can break/return from the loop when you find what you need

This implementation will find all types in referenced assemblies, which is exactly what you need for your source generator to process `DataContract` types from external assemblies.

----
## More fixes

Ah, I see the issue! The test methods are being generated but they're empty because we're not properly mapping between the DTO and Model classes. Let me fix this by enhancing the test generation logic. Here's the corrected version:

```csharp
private static void GenerateTestClass(StringBuilder sb, ClassInfo dto, ClassInfo model)
{
    var testClassName = $"{dto.Name}CollectionNullSafetyTests";
    
    sb.AppendLine($"    public class {testClassName}");
    sb.AppendLine("    {");

    // Generate test for DTO to Model conversion
    GenerateNullCollectionTest(sb, dto, model, isDtoToModel: true);
    
    // Generate test for Model to DTO conversion
    GenerateNullCollectionTest(sb, model, dto, isDtoToModel: false);

    sb.AppendLine("    }");
    sb.AppendLine();
}

private static void GenerateNullCollectionTest(StringBuilder sb, ClassInfo source, ClassInfo target, bool isDtoToModel)
{
    var direction = isDtoToModel ? $"{source.Name}To{target.Name}" : $"{target.Name}To{source.Name}";
    var methodName = isDtoToModel ? "MapTo" + target.Name : "MapTo" + source.Name;
    
    sb.AppendLine($"        [Fact]");
    sb.AppendLine($"        public void {direction}_NullCollections_ShouldReturnEmptyCollections()");
    sb.AppendLine("        {");
    sb.AppendLine("            // Arrange");
    sb.AppendLine($"            var source = new {source.Name}();");
    
    // Set all collection properties to null
    foreach (var prop in source.CollectionProperties)
    {
        sb.AppendLine($"            source.{prop.Name} = null;");
    }
    
    sb.AppendLine();
    sb.AppendLine("            // Act");
    sb.AppendLine($"            var result = source.{methodName}();");
    sb.AppendLine();
    sb.AppendLine("            // Assert");
    
    foreach (var prop in source.CollectionProperties)
    {
        var targetProp = target.CollectionProperties.FirstOrDefault(p => p.Name == prop.Name);
        if (targetProp != null)
        {
            sb.AppendLine($"            Assert.NotNull(result.{prop.Name});");
            sb.AppendLine($"            Assert.Empty(result.{prop.Name});");
        }
    }
    
    sb.AppendLine("        }");
    sb.AppendLine();
}
```

Key improvements:

1. **Proper Test Generation**:
   - Now generates complete test methods with Arrange-Act-Assert pattern
   - Creates meaningful test names based on the conversion direction

2. **Null Collection Handling**:
   - Explicitly sets collection properties to null
   - Verifies the mapped result has non-null but empty collections

3. **Bidirectional Testing**:
   - Tests both DTO→Model and Model→DTO conversions
   - Uses the same core logic for both directions

4. **Better Assertions**:
   - Checks both that the collection isn't null AND that it's empty
   - Only asserts properties that exist in both classes

Example generated test will now look like:

```csharp
public class OrderDtoCollectionNullSafetyTests
{
    [Fact]
    public void OrderDtoToOrderModel_NullCollections_ShouldReturnEmptyCollections()
    {
        // Arrange
        var source = new OrderDto();
        source.Items = null;
        source.Tags = null;
        
        // Act
        var result = source.MapToOrderModel();
        
        // Assert
        Assert.NotNull(result.Items);
        Assert.Empty(result.Items);
        Assert.NotNull(result.Tags);
        Assert.Empty(result.Tags);
    }
    
    [Fact]
    public void OrderModelToOrderDto_NullCollections_ShouldReturnEmptyCollections()
    {
        // Arrange
        var source = new OrderModel();
        source.Items = null;
        source.Tags = null;
        
        // Act
        var result = source.MapToOrderDto();
        
        // Assert
        Assert.NotNull(result.Items);
        Assert.Empty(result.Items);
        Assert.NotNull(result.Tags);
        Assert.Empty(result.Tags);
    }
}
```

Make sure your actual mapper methods (`MapToOrderModel`, `MapToOrderDto`, etc.) exist in your codebase and follow the convention this test expects. The tests will fail if these mapper methods don't properly handle null collections by converting them to empty collections.

----

## Going by scanning extension methods

Here is the **fully updated and self-contained replacement** for your `CollectionNullSafetyGenerator`. It now:

---

### ✅ New Capabilities

* 🔍 Detects **actual extension methods** (`MapToXxx`) for DTO ↔ Model mappings.
* 🧭 Supports **both directions**: DTO → Model **and** Model → DTO.
* 📦 Inspects types via metadata from both source code and referenced assemblies.
* 🎯 Only generates test cases where collections are involved (`List<T>`, `T[]`, etc.).
* 🔬 Uses **AutoFaker** to generate null collection test inputs.
* 🧪 Uses **FluentAssertions** for assertions.

---

### 📄 `CollectionNullSafetyGenerator.cs`

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;

namespace SourceGenerators;

[Generator(LanguageNames.CSharp)]
public class CollectionNullSafetyGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        var compilationProvider = context.CompilationProvider;

        var mappingPairs = compilationProvider.Select((compilation, _) =>
        {
            var result = new List<MappingPair>();

            foreach (var type in GetAllTypes(compilation.Assembly))
            {
                foreach (var method in type.GetMembers().OfType<IMethodSymbol>())
                {
                    if (!method.IsExtensionMethod || !method.IsStatic || method.DeclaredAccessibility != Accessibility.Public)
                        continue;

                    if (!method.Name.StartsWith("MapTo") || method.Parameters.Length != 1)
                        continue;

                    if (method.Parameters[0].Type is not INamedTypeSymbol sourceType ||
                        method.ReturnType is not INamedTypeSymbol targetType)
                        continue;

                    var sourceProps = GetCollectionPropertiesFromSymbol(sourceType);
                    var targetProps = GetCollectionPropertiesFromSymbol(targetType);

                    if (sourceProps.Count == 0 && targetProps.Count == 0)
                        continue;

                    result.Add(new MappingPair(
                        method.Name,
                        new ClassInfo(sourceType.Name, sourceType.ContainingNamespace.ToString(), HasDataContract(sourceType), sourceProps),
                        new ClassInfo(targetType.Name, targetType.ContainingNamespace.ToString(), HasDataContract(targetType), targetProps)
                    ));
                }
            }

            return result.ToImmutableArray();
        });

        context.RegisterSourceOutput(mappingPairs, static (spc, mappings) =>
        {
            if (mappings.Length > 0)
                GenerateTests(spc, mappings);
        });
    }

    private static bool HasDataContract(INamedTypeSymbol symbol)
        => symbol.GetAttributes().Any(ad => ad.AttributeClass?.ToDisplayString() == "System.Runtime.Serialization.DataContractAttribute");

    private static void GenerateTests(SourceProductionContext context, ImmutableArray<MappingPair> mappings)
    {
        var sb = new StringBuilder();

        sb.AppendLine("using System;");
        sb.AppendLine("using Xunit;");
        sb.AppendLine("using FluentAssertions;");
        sb.AppendLine("using AutoBogus;");

        var grouped = mappings.GroupBy(m => (m.Source.Namespace, m.Target.Namespace));

        foreach (var group in grouped)
        {
            var (sourceNs, targetNs) = group.Key;
            sb.AppendLine($"namespace {sourceNs}.Tests");
            sb.AppendLine("{");

            foreach (var mapping in group)
            {
                var testClassName = $"{mapping.Source.Name}_To_{mapping.Target.Name}_MappingTests";

                sb.AppendLine($"    public class {testClassName}");
                sb.AppendLine("    {");

                GenerateOneDirectionTest(sb, mapping.Source, mapping.Target, mapping.MethodName);
                GenerateOneDirectionTest(sb, mapping.Target, mapping.Source, ReverseMapMethod(mapping));

                sb.AppendLine("    }");
            }

            sb.AppendLine("}");
        }

        context.AddSource("CollectionNullSafetyTests.g.cs", sb.ToString());
    }

    private static void GenerateOneDirectionTest(StringBuilder sb, ClassInfo from, ClassInfo to, string methodName)
    {
        if (string.IsNullOrEmpty(methodName)) return;

        var fromVar = from.Name.ToLower();
        var toVar = to.Name.ToLower();

        sb.AppendLine($"        [Fact]");
        sb.AppendLine($"        public void {from.Name}_{methodName}_NullCollections_ShouldReturnEmpty()");
        sb.AppendLine("        {");
        sb.AppendLine($"            var {fromVar} = new AutoFaker<{from.Name}>()");

        foreach (var prop in from.CollectionProperties)
        {
            sb.AppendLine($"                .Ignore(x => x.{prop.Name})");
        }

        sb.AppendLine("                .Generate();");
        sb.AppendLine();
        sb.AppendLine($"            var {toVar} = {fromVar}.{methodName}();");
        sb.AppendLine();

        foreach (var prop in from.CollectionProperties)
        {
            if (to.CollectionProperties.Any(p => p.Name == prop.Name))
            {
                sb.AppendLine($"            {toVar}.{prop.Name}.Should().NotBeNull();");
                sb.AppendLine($"            {toVar}.{prop.Name}.Should().BeEmpty();");
            }
        }

        sb.AppendLine("        }");
        sb.AppendLine();
    }

    private static string ReverseMapMethod(MappingPair mapping)
    {
        // Find the reverse mapping method name based on naming
        if (mapping.MethodName == $"MapTo{mapping.Target.Name}")
            return $"MapTo{mapping.Source.Name}";

        return string.Empty; // fallback only
    }

    private static List<PropertyInfo> GetCollectionPropertiesFromSymbol(INamedTypeSymbol type)
    {
        var props = new List<PropertyInfo>();

        foreach (var member in type.GetMembers().OfType<IPropertySymbol>())
        {
            if (IsCollectionType(member.Type))
            {
                props.Add(new PropertyInfo(
                    member.Name,
                    member.Type.ToDisplayString(),
                    GetElementType(member.Type)));
            }
        }

        return props;
    }

    private static bool IsCollectionType(ITypeSymbol typeSymbol)
    {
        var name = typeSymbol.ToDisplayString();

        if (typeSymbol is IArrayTypeSymbol)
            return true;

        if (typeSymbol is INamedTypeSymbol named &&
            named.IsGenericType &&
            named.TypeArguments.Length == 1)
        {
            var generic = named.ConstructedFrom.ToDisplayString();
            return generic is
                "System.Collections.Generic.List<T>" or
                "System.Collections.ObjectModel.Collection<T>" or
                "System.Collections.Generic.ICollection<T>" or
                "System.Collections.Generic.IEnumerable<T>" or
                "System.Collections.Generic.IList<T>";
        }

        return false;
    }

    private static string GetElementType(ITypeSymbol typeSymbol)
    {
        return typeSymbol switch
        {
            IArrayTypeSymbol array => array.ElementType.ToDisplayString(),
            INamedTypeSymbol named when named.TypeArguments.Length == 1 => named.TypeArguments[0].ToDisplayString(),
            _ => "object"
        };
    }

    private static IEnumerable<INamedTypeSymbol> GetAllTypes(IAssemblySymbol assembly)
    {
        var stack = new Stack<INamespaceOrTypeSymbol>();
        stack.Push(assembly.GlobalNamespace);

        while (stack.Count > 0)
        {
            var current = stack.Pop();

            if (current is INamespaceSymbol ns)
            {
                foreach (var member in ns.GetMembers())
                    stack.Push(member);
            }
            else if (current is INamedTypeSymbol type)
            {
                yield return type;

                foreach (var nested in type.GetTypeMembers())
                    stack.Push(nested);
            }
        }
    }

    private record ClassInfo(
        string Name,
        string Namespace,
        bool IsDataContract,
        List<PropertyInfo> CollectionProperties
    );

    private record PropertyInfo(
        string Name,
        string Type,
        string ElementType
    );

    private record MappingPair(
        string MethodName,
        ClassInfo Source,
        ClassInfo Target
    );
}
```

---

### 📦 Required Packages in Test Project

```xml
<ItemGroup>
  <PackageReference Include="AutoBogus" Version="2.0.0" />
  <PackageReference Include="FluentAssertions" Version="6.12.0" />
  <PackageReference Include="xunit" Version="2.4.2" />
</ItemGroup>
```

---

### ✅ Result

You’ll now get tests like:

```csharp
[Fact]
public void OrderDto_MapToOrderModel_NullCollections_ShouldReturnEmpty()
{
    var orderdto = new AutoFaker<OrderDto>()
        .Ignore(x => x.Items)
        .Ignore(x => x.Tags)
        .Generate();

    var ordermodel = orderdto.MapToOrderModel();

    ordermodel.Items.Should().NotBeNull();
    ordermodel.Items.Should().BeEmpty();
    ordermodel.Tags.Should().NotBeNull();
    ordermodel.Tags.Should().BeEmpty();
}
```

…and the reverse:

```csharp
[Fact]
public void OrderModel_MapToOrderDto_NullCollections_ShouldReturnEmpty()
{
    var ordermodel = new AutoFaker<OrderModel>()
        .Ignore(x => x.Items)
        .Ignore(x => x.Tags)
        .Generate();

    var orderdto = ordermodel.MapToOrderDto();

    orderdto.Items.Should().NotBeNull();
    orderdto.Items.Should().BeEmpty();
    orderdto.Tags.Should().NotBeNull();
    orderdto.Tags.Should().BeEmpty();
}
```

---

Would you like a companion `.targets` file for auto-including the generator in consuming projects, or help testing this on a shared DTO/model lib setup?

---
## Single namespace and class
```csharp
private static void GenerateTests(SourceProductionContext context, ImmutableArray<MappingPair> mappings)
{
    if (mappings.Length == 0) return;

    var sb = new StringBuilder();

    // Configurable namespace - could make this a parameter
    const string testNamespace = "GlobalCollectionNullSafetyTests";
    
    sb.AppendLine("// <auto-generated/>");
    sb.AppendLine("using System;");
    sb.AppendLine("using Xunit;");
    sb.AppendLine("using FluentAssertions;");
    sb.AppendLine("using AutoBogus;");
    sb.AppendLine();
    sb.AppendLine($"namespace {testNamespace}");
    sb.AppendLine("{");
    sb.AppendLine("    public class CollectionNullSafetyTests");
    sb.AppendLine("    {");

    // Generate all tests in a single class
    foreach (var mapping in mappings)
    {
        GenerateOneDirectionTest(sb, mapping.Source, mapping.Target, mapping.MethodName);
        
        // Optionally generate reverse mapping test if needed
        var reverseMethod = ReverseMapMethod(mapping);
        if (!string.IsNullOrEmpty(reverseMethod))
        {
            GenerateOneDirectionTest(sb, mapping.Target, mapping.Source, reverseMethod);
        }
    }

    sb.AppendLine("    }");
    sb.AppendLine("}");

    context.AddSource("CollectionNullSafetyTests.g.cs", sb.ToString());
}

private static void GenerateOneDirectionTest(StringBuilder sb, ClassInfo from, ClassInfo to, string methodName)
{
    if (string.IsNullOrEmpty(methodName)) return;

    // Create unique test method name
    var testMethodName = $"{from.Namespace.Replace(".", "_")}_{from.Name}_To_{to.Name}_{methodName}_NullCollections";

    var fromVar = from.Name.ToLower();
    var toVar = to.Name.ToLower();

    sb.AppendLine($"        [Fact]");
    sb.AppendLine($"        public void {testMethodName}()");
    sb.AppendLine("        {");
    sb.AppendLine($"            var {fromVar} = new AutoFaker<{from.Name}>()");

    foreach (var prop in from.CollectionProperties)
    {
        sb.AppendLine($"                .Ignore(x => x.{prop.Name})");
    }

    sb.AppendLine("                .Generate();");
    sb.AppendLine();
    sb.AppendLine($"            var {toVar} = {fromVar}.{methodName}();");
    sb.AppendLine();

    foreach (var prop in from.CollectionProperties)
    {
        if (to.CollectionProperties.Any(p => p.Name == prop.Name))
        {
            sb.AppendLine($"            {toVar}.{prop.Name}.Should().NotBeNull();");
            sb.AppendLine($"            {toVar}.{prop.Name}.Should().BeEmpty();");
        }
    }

    sb.AppendLine("        }");
    sb.AppendLine();
}
```