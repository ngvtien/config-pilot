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