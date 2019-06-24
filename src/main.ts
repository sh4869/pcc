interface Dependency {
    name: string;
    // TODO: 複雑な依存条件の設定が可能にする
    version: string;
    depndencies: Dependency[];
}

interface DependencyGraphNode {
    parent: Symbol;
    self: Symbol;
    // 内容
    dependency: Dependency;
    // 深さ
    depth: number;
}

interface DependencyGraph {
    // package.jsonに明記されているDependenciesを書く。
    dependencies: DependencyGraphNode[]; 
}

const getAllDepndencies = (dependencies: Dependency[]) => {
}

console.log("hello,world")